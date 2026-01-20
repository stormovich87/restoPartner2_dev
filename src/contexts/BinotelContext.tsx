import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export interface BinotelCall {
  id: string;
  phone: string;
  branch_id: string | null;
  call_type: number;
  call_status: string | null;
  client_id: string | null;
  client_name?: string | null;
  general_call_id?: string | null;
  is_missed: boolean;
  is_outgoing: boolean;
  created_at: string;
}

export interface MissedCall extends BinotelCall {
  is_missed_seen: boolean;
}

export interface ClientDrawerData {
  isOpen: boolean;
  phone: string | null;
  clientId: string | null;
  clientName: string | null;
  branchId: string | null;
  generalCallId: string | null;
}

interface BinotelContextType {
  incomingCalls: BinotelCall[];
  outgoingCalls: BinotelCall[];
  missedCalls: MissedCall[];
  clientDrawer: ClientDrawerData;
  dismissIncomingCall: (callId: string) => void;
  dismissOutgoingCall: (callId: string) => void;
  openClientDrawer: (phone: string, clientId: string | null, clientName: string | null, branchId: string | null, generalCallId: string | null) => void;
  closeClientDrawer: () => void;
  fetchMissedCalls: () => Promise<void>;
  markMissedCallSeen: (callId: string) => Promise<void>;
}

const BinotelContext = createContext<BinotelContextType | undefined>(undefined);

export function BinotelProvider({
  children,
  partnerId,
  userBranchIds,
}: {
  children: ReactNode;
  partnerId: string | null;
  userBranchIds: string[];
}) {
  const [incomingCalls, setIncomingCalls] = useState<BinotelCall[]>([]);
  const [outgoingCalls, setOutgoingCalls] = useState<BinotelCall[]>([]);
  const [missedCalls, setMissedCalls] = useState<MissedCall[]>([]);
  const [clientDrawer, setClientDrawer] = useState<ClientDrawerData>({
    isOpen: false,
    phone: null,
    clientId: null,
    clientName: null,
    branchId: null,
    generalCallId: null,
  });

  const fetchMissedCalls = async () => {
    if (!partnerId) return;

    let query = supabase
      .from('binotel_calls')
      .select(`
        id,
        external_number,
        branch_id,
        call_type,
        call_status,
        client_id,
        general_call_id,
        is_missed,
        is_missed_seen,
        is_outgoing,
        created_at,
        clients (
          first_name,
          last_name,
          phone
        )
      `)
      .eq('partner_id', partnerId)
      .eq('is_missed', true)
      .eq('is_missed_seen', false)
      .order('created_at', { ascending: false });

    // Only apply branch filter if userBranchIds is not empty
    // If empty, show all calls for the partner (no branch restriction)
    if (userBranchIds.length > 0) {
      query = query.in('branch_id', userBranchIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching missed calls:', error);
      return;
    }

    const calls: MissedCall[] = (data || []).map((call: any) => {
      let displayName: string | null = null;

      if (call.clients) {
        const firstName = call.clients.first_name || '';
        const lastName = call.clients.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        // If fullName is empty, use phone as fallback
        displayName = fullName || call.clients.phone || null;
      }

      return {
        id: call.id,
        phone: call.external_number,
        branch_id: call.branch_id,
        call_type: call.call_type,
        call_status: call.call_status,
        client_id: call.client_id,
        client_name: displayName,
        general_call_id: call.general_call_id,
        is_missed: call.is_missed,
        is_missed_seen: call.is_missed_seen,
        is_outgoing: call.is_outgoing,
        created_at: call.created_at,
      };
    });

    setMissedCalls(calls);
  };

  const markMissedCallSeen = async (callId: string) => {
    const { error } = await supabase
      .from('binotel_calls')
      .update({ is_missed_seen: true })
      .eq('id', callId);

    if (error) {
      console.error('Error marking call as seen:', error);
      return;
    }

    setMissedCalls(prev => prev.filter(call => call.id !== callId));
  };

  useEffect(() => {
    if (partnerId) {
      fetchMissedCalls();
    }
  }, [partnerId, userBranchIds.join(',')]);

  useEffect(() => {
    if (!partnerId) return;

    console.log('[BinotelContext] Setting up realtime subscription for partner:', partnerId);
    console.log('[BinotelContext] User branch IDs:', userBranchIds);

    const channel = supabase
      .channel(`binotel-calls-${partnerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'binotel_calls',
          filter: `partner_id=eq.${partnerId}`,
        },
        async (payload) => {
          console.log('[BinotelContext] INSERT event received:', payload);
          const newCall = payload.new as any;

          if (newCall.completed_at) {
            console.log('[BinotelContext] INSERT - Call already completed, ignoring');
            return;
          }

          // Only apply branch filter if userBranchIds is not empty
          if (userBranchIds.length > 0 && newCall.branch_id) {
            if (!userBranchIds.includes(newCall.branch_id)) {
              console.log('[BinotelContext] Call ignored - branch not in user branches:', newCall.branch_id);
              return;
            }
          }

          let clientName: string | null = null;

          if (newCall.client_id) {
            const { data: clientData } = await supabase
              .from('clients')
              .select('first_name, last_name, phone')
              .eq('id', newCall.client_id)
              .maybeSingle();

            if (clientData) {
              const firstName = clientData.first_name || '';
              const lastName = clientData.last_name || '';
              const fullName = `${firstName} ${lastName}`.trim();
              // If fullName is empty, use phone as fallback
              clientName = fullName || clientData.phone || null;
            }
          }

          const callData: BinotelCall = {
            id: newCall.id,
            phone: newCall.external_number,
            branch_id: newCall.branch_id,
            call_type: newCall.call_type,
            call_status: newCall.call_status,
            client_id: newCall.client_id,
            client_name: clientName,
            general_call_id: newCall.general_call_id,
            is_missed: newCall.is_missed || false,
            is_outgoing: newCall.is_outgoing || false,
            created_at: newCall.created_at,
          };

          console.log('[BinotelContext] Processed call data:', callData);

          if (newCall.is_outgoing) {
            console.log('[BinotelContext] Adding to outgoing calls');
            setOutgoingCalls(prev => [callData, ...prev]);
          } else {
            console.log('[BinotelContext] Adding to incoming calls and opening drawer');
            setIncomingCalls(prev => [callData, ...prev]);
            openClientDrawer(
              callData.phone,
              callData.client_id,
              callData.client_name || null,
              callData.branch_id,
              callData.general_call_id || null
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'binotel_calls',
          filter: `partner_id=eq.${partnerId}`,
        },
        async (payload) => {
          console.log('[BinotelContext] UPDATE event received:', payload);
          const updatedCall = payload.new as any;

          // Only apply branch filter if userBranchIds is not empty
          if (userBranchIds.length > 0 && updatedCall.branch_id) {
            if (!userBranchIds.includes(updatedCall.branch_id)) {
              console.log('[BinotelContext] Call ignored - branch not in user branches:', updatedCall.branch_id);
              return;
            }
          }

          if (updatedCall.is_missed && !updatedCall.is_missed_seen) {
            console.log('[BinotelContext] Fetching missed calls due to UPDATE');
            await fetchMissedCalls();
          }

          const existsInIncoming = incomingCalls.some(call => call.id === updatedCall.id);
          const existsInOutgoing = outgoingCalls.some(call => call.id === updatedCall.id);

          if (!existsInIncoming && !existsInOutgoing && !updatedCall.completed_at) {
            console.log('[BinotelContext] New call detected via UPDATE, adding to notifications');

            let clientName: string | null = null;
            if (updatedCall.client_id) {
              const { data: clientData } = await supabase
                .from('clients')
                .select('first_name, last_name, phone')
                .eq('id', updatedCall.client_id)
                .maybeSingle();

              if (clientData) {
                const firstName = clientData.first_name || '';
                const lastName = clientData.last_name || '';
                const fullName = `${firstName} ${lastName}`.trim();
                // If fullName is empty, use phone as fallback
                clientName = fullName || clientData.phone || null;
              }
            }

            const callData: BinotelCall = {
              id: updatedCall.id,
              phone: updatedCall.external_number,
              branch_id: updatedCall.branch_id,
              call_type: updatedCall.call_type,
              call_status: updatedCall.call_status,
              client_id: updatedCall.client_id,
              client_name: clientName,
              general_call_id: updatedCall.general_call_id,
              is_missed: updatedCall.is_missed || false,
              is_outgoing: updatedCall.is_outgoing || false,
              created_at: updatedCall.created_at,
            };

            if (updatedCall.is_outgoing) {
              console.log('[BinotelContext] Adding to outgoing calls');
              setOutgoingCalls(prev => [callData, ...prev]);
            } else {
              console.log('[BinotelContext] Adding to incoming calls and opening drawer');
              setIncomingCalls(prev => [callData, ...prev]);
              openClientDrawer(
                callData.phone,
                callData.client_id,
                callData.client_name || null,
                callData.branch_id,
                callData.general_call_id || null
              );
            }
          } else {
            if (updatedCall.completed_at) {
              if (updatedCall.is_missed) {
                console.log('[BinotelContext] Call missed, updating status in notifications');
                setIncomingCalls(prev =>
                  prev.map(call =>
                    call.id === updatedCall.id
                      ? { ...call, call_status: updatedCall.call_status, is_missed: true, created_at: call.created_at }
                      : call
                  )
                );
              } else {
                console.log('[BinotelContext] Call answered, removing from notifications');
                setIncomingCalls(prev => prev.filter(call => call.id !== updatedCall.id));
                setOutgoingCalls(prev => prev.filter(call => call.id !== updatedCall.id));
              }
            } else {
              setIncomingCalls(prev =>
                prev.map(call =>
                  call.id === updatedCall.id
                    ? { ...call, call_status: updatedCall.call_status, is_missed: updatedCall.is_missed }
                    : call
                )
              );

              setOutgoingCalls(prev =>
                prev.map(call =>
                  call.id === updatedCall.id
                    ? { ...call, call_status: updatedCall.call_status, is_missed: updatedCall.is_missed }
                    : call
                )
              );
            }
          }
        }
      )
      .subscribe((status, err) => {
        console.log('[BinotelContext] Realtime subscription status:', status);
        if (err) {
          console.error('[BinotelContext] Realtime subscription error:', err);
        }

        if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          console.log('[BinotelContext] Attempting to reconnect...');
          setTimeout(() => {
            supabase.removeChannel(channel);
          }, 1000);
        }
      });

    return () => {
      console.log('[BinotelContext] Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [partnerId, userBranchIds.join(',')]);

  const dismissIncomingCall = (callId: string) => {
    setIncomingCalls(prev => prev.filter(call => call.id !== callId));
  };

  const dismissOutgoingCall = (callId: string) => {
    setOutgoingCalls(prev => prev.filter(call => call.id !== callId));
  };

  const openClientDrawer = (
    phone: string,
    clientId: string | null,
    clientName: string | null,
    branchId: string | null,
    generalCallId: string | null
  ) => {
    setClientDrawer({
      isOpen: true,
      phone,
      clientId,
      clientName,
      branchId,
      generalCallId,
    });
  };

  const closeClientDrawer = () => {
    setClientDrawer({
      isOpen: false,
      phone: null,
      clientId: null,
      clientName: null,
      branchId: null,
      generalCallId: null,
    });
  };

  return (
    <BinotelContext.Provider
      value={{
        incomingCalls,
        outgoingCalls,
        missedCalls,
        clientDrawer,
        dismissIncomingCall,
        dismissOutgoingCall,
        openClientDrawer,
        closeClientDrawer,
        fetchMissedCalls,
        markMissedCallSeen,
      }}
    >
      {children}
    </BinotelContext.Provider>
  );
}

export function useBinotel() {
  const context = useContext(BinotelContext);
  if (context === undefined) {
    throw new Error('useBinotel must be used within a BinotelProvider');
  }
  return context;
}
