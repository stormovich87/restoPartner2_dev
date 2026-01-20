import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Printer as PrinterIcon,
  Settings,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  Save,
  Wifi,
  WifiOff,
  FileText,
  HelpCircle,
  X
} from 'lucide-react';
import type { Printer, BranchPrintSettings, Branch } from '../../types';

interface PrintSettingsProps {
  partnerId: string;
}

interface PrintAgentSettings {
  print_agent_name: string;
  print_agent_base_url: string;
  print_agent_health_path: string;
  print_agent_print_path: string;
  print_agent_version: string;
  print_agent_apk_public_url: string | null;
  print_agent_required: boolean;
}

const ORDER_STATUSES = [
  { value: 'pending', label: 'Новый' },
  { value: 'accepted', label: 'Принят' },
  { value: 'preparing', label: 'Готовится' },
  { value: 'ready', label: 'Готов' },
  { value: 'en_route', label: 'В пути' },
  { value: 'completed', label: 'Доставлен' },
];

export default function PrintSettings({ partnerId }: PrintSettingsProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [agentSettings, setAgentSettings] = useState<PrintAgentSettings | null>(null);
  const [agentStatus, setAgentStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [printSettings, setPrintSettings] = useState<BranchPrintSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [printerTests, setPrinterTests] = useState<Record<string, 'idle' | 'testing' | 'success' | 'error'>>({});
  const [showNewPrinterForm, setShowNewPrinterForm] = useState(false);
  const [newPrinter, setNewPrinter] = useState({ name: '', ip: '', port: 9100, paper_width: 80 as 58 | 80 });

  useEffect(() => {
    loadBranches();
    loadAgentSettings();
  }, [partnerId]);

  useEffect(() => {
    if (selectedBranchId) {
      loadBranchData();
    }
  }, [selectedBranchId]);

  useEffect(() => {
    if (agentSettings) {
      checkPrintAgent();
    }
  }, [agentSettings]);

  const loadBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('partner_id', partnerId)
      .eq('status', 'active')
      .order('name');

    if (data) {
      setBranches(data);
      if (data.length > 0 && !selectedBranchId) {
        setSelectedBranchId(data[0].id);
      }
    }
  };

  const loadAgentSettings = async () => {
    const { data } = await supabase
      .from('partner_settings')
      .select(`
        print_agent_name,
        print_agent_base_url,
        print_agent_health_path,
        print_agent_print_path,
        print_agent_version,
        print_agent_apk_public_url,
        print_agent_required
      `)
      .eq('partner_id', partnerId)
      .maybeSingle();

    if (data) {
      setAgentSettings({
        print_agent_name: data.print_agent_name || 'Print Hub',
        print_agent_base_url: data.print_agent_base_url || 'http://127.0.0.1:17800',
        print_agent_health_path: data.print_agent_health_path || '/health',
        print_agent_print_path: data.print_agent_print_path || '/print',
        print_agent_version: data.print_agent_version || '1.0.0',
        print_agent_apk_public_url: data.print_agent_apk_public_url,
        print_agent_required: data.print_agent_required ?? true,
      });
    } else {
      setAgentSettings({
        print_agent_name: 'Print Hub',
        print_agent_base_url: 'http://127.0.0.1:17800',
        print_agent_health_path: '/health',
        print_agent_print_path: '/print',
        print_agent_version: '1.0.0',
        print_agent_apk_public_url: null,
        print_agent_required: true,
      });
    }
    setLoading(false);
  };

  const loadBranchData = async () => {
    if (!selectedBranchId) return;

    const [printersRes, settingsRes] = await Promise.all([
      supabase.from('printers').select('*').eq('branch_id', selectedBranchId).order('name'),
      supabase.from('branch_print_settings').select('*').eq('branch_id', selectedBranchId).maybeSingle(),
    ]);

    if (printersRes.data) {
      setPrinters(printersRes.data);
    }

    if (settingsRes.data) {
      setPrintSettings(settingsRes.data);
    } else {
      setPrintSettings(null);
    }
  };

  const checkPrintAgent = useCallback(async () => {
    if (!agentSettings) return;

    setAgentStatus('checking');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(
        `${agentSettings.print_agent_base_url}${agentSettings.print_agent_health_path}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        setAgentStatus('online');
      } else {
        setAgentStatus('offline');
      }
    } catch {
      setAgentStatus('offline');
    }
  }, [agentSettings]);

  const testPrinterConnection = async (printer: Printer) => {
    if (!agentSettings) return;

    setPrinterTests(prev => ({ ...prev, [printer.id]: 'testing' }));

    try {
      const response = await fetch(
        `${agentSettings.print_agent_base_url}${agentSettings.print_agent_print_path}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            printer_ip: printer.ip,
            printer_port: printer.port,
            text: '',
          }),
        }
      );

      if (response.ok) {
        setPrinterTests(prev => ({ ...prev, [printer.id]: 'success' }));
      } else {
        setPrinterTests(prev => ({ ...prev, [printer.id]: 'error' }));
      }
    } catch {
      setPrinterTests(prev => ({ ...prev, [printer.id]: 'error' }));
    }

    setTimeout(() => {
      setPrinterTests(prev => ({ ...prev, [printer.id]: 'idle' }));
    }, 3000);
  };

  const printTestReceipt = async (printer: Printer) => {
    if (!agentSettings) return;

    const branch = branches.find(b => b.id === selectedBranchId);
    const now = new Date().toLocaleString('ru-RU');

    const testText = `
================================
       ТЕСТОВЫЙ ЧЕК
================================

Филиал: ${branch?.name || 'Неизвестно'}
Принтер: ${printer.name}
IP: ${printer.ip}:${printer.port}
Ширина бумаги: ${printer.paper_width}mm

Дата: ${now}

--------------------------------
Если вы видите этот текст,
печать работает корректно!
--------------------------------

================================
`;

    setPrinterTests(prev => ({ ...prev, [printer.id]: 'testing' }));

    try {
      const response = await fetch(
        `${agentSettings.print_agent_base_url}${agentSettings.print_agent_print_path}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            printer_ip: printer.ip,
            printer_port: printer.port,
            text: testText,
          }),
        }
      );

      if (response.ok) {
        setPrinterTests(prev => ({ ...prev, [printer.id]: 'success' }));
        setMessage({ type: 'success', text: 'Тестовый чек отправлен на печать' });
      } else {
        setPrinterTests(prev => ({ ...prev, [printer.id]: 'error' }));
        setMessage({ type: 'error', text: 'Ошибка отправки тестового чека' });
      }
    } catch {
      setPrinterTests(prev => ({ ...prev, [printer.id]: 'error' }));
      setMessage({ type: 'error', text: 'Принтер недоступен' });
    }

    setTimeout(() => {
      setPrinterTests(prev => ({ ...prev, [printer.id]: 'idle' }));
    }, 3000);
  };

  const addPrinter = async () => {
    if (!newPrinter.name || !newPrinter.ip) return;

    setSaving(true);
    const { data, error } = await supabase
      .from('printers')
      .insert({
        partner_id: partnerId,
        branch_id: selectedBranchId,
        name: newPrinter.name,
        ip: newPrinter.ip,
        port: newPrinter.port,
        paper_width: newPrinter.paper_width,
      })
      .select()
      .single();

    if (error) {
      setMessage({ type: 'error', text: 'Ошибка добавления принтера' });
    } else if (data) {
      setPrinters(prev => [...prev, data]);
      setNewPrinter({ name: '', ip: '', port: 9100, paper_width: 80 });
      setShowNewPrinterForm(false);
      setMessage({ type: 'success', text: 'Принтер добавлен' });
    }
    setSaving(false);
  };

  const deletePrinter = async (printerId: string) => {
    if (!confirm('Удалить принтер?')) return;

    await supabase.from('printers').delete().eq('id', printerId);
    setPrinters(prev => prev.filter(p => p.id !== printerId));
    setMessage({ type: 'success', text: 'Принтер удален' });
  };

  const togglePrinterEnabled = async (printer: Printer) => {
    await supabase
      .from('printers')
      .update({ enabled: !printer.enabled })
      .eq('id', printer.id);

    setPrinters(prev => prev.map(p =>
      p.id === printer.id ? { ...p, enabled: !p.enabled } : p
    ));
  };

  const savePrintSettings = async () => {
    if (!selectedBranchId) return;

    setSaving(true);

    const settingsData = {
      partner_id: partnerId,
      branch_id: selectedBranchId,
      printing_enabled: printSettings?.printing_enabled ?? false,
      auto_print_new_order: printSettings?.auto_print_new_order ?? false,
      auto_print_statuses: printSettings?.auto_print_statuses ?? [],
      default_printer_id: printSettings?.default_printer_id ?? null,
      copies: printSettings?.copies ?? 1,
    };

    if (printSettings?.id) {
      await supabase
        .from('branch_print_settings')
        .update(settingsData)
        .eq('id', printSettings.id);
    } else {
      const { data } = await supabase
        .from('branch_print_settings')
        .insert(settingsData)
        .select()
        .single();

      if (data) setPrintSettings(data);
    }

    setMessage({ type: 'success', text: 'Настройки сохранены' });
    setSaving(false);
  };

  const canPrint = agentStatus === 'online' && printers.some(p => p.enabled);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Настройки печати</h2>
          <p className="text-sm text-gray-500 mt-1">
            {agentSettings?.print_agent_name} - локальный агент печати чеков
          </p>
        </div>

        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {branches.map(branch => (
            <option key={branch.id} value={branch.id}>{branch.name}</option>
          ))}
        </select>
      </div>

      <div className={`p-6 rounded-xl border-2 ${
        agentStatus === 'online'
          ? 'bg-green-50 border-green-200'
          : agentStatus === 'checking'
          ? 'bg-gray-50 border-gray-200'
          : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-full ${
            agentStatus === 'online' ? 'bg-green-100' : agentStatus === 'checking' ? 'bg-gray-100' : 'bg-red-100'
          }`}>
            {agentStatus === 'online' ? (
              <Wifi className="w-6 h-6 text-green-600" />
            ) : agentStatus === 'checking' ? (
              <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
            ) : (
              <WifiOff className="w-6 h-6 text-red-600" />
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">
                {agentStatus === 'online'
                  ? 'Агент печати установлен и работает'
                  : agentStatus === 'checking'
                  ? 'Проверка агента...'
                  : 'Агент печати не установлен или не запущен'
                }
              </h3>
              {agentStatus === 'online' && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                  v{agentSettings?.print_agent_version}
                </span>
              )}
            </div>

            {agentStatus === 'offline' && (
              <p className="text-gray-600 mt-1">
                Без {agentSettings?.print_agent_name} печать чеков и автопечать работать не будут.
              </p>
            )}

            {agentStatus === 'online' && canPrint && (
              <p className="text-green-700 mt-1">
                Печать доступна. Принтеры филиала готовы к работе.
              </p>
            )}

            {agentStatus === 'online' && !canPrint && (
              <p className="text-yellow-700 mt-1">
                Агент работает, но нет активных принтеров. Добавьте принтер ниже.
              </p>
            )}

            <div className="flex gap-3 mt-4">
              {agentStatus === 'offline' && agentSettings?.print_agent_apk_public_url && (
                <a
                  href={agentSettings.print_agent_apk_public_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Установить агент печати
                </a>
              )}

              {agentStatus === 'offline' && (
                <button
                  onClick={() => setShowInstallGuide(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <HelpCircle className="w-4 h-4" />
                  Инструкция
                </button>
              )}

              <button
                onClick={checkPrintAgent}
                disabled={agentStatus === 'checking'}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${agentStatus === 'checking' ? 'animate-spin' : ''}`} />
                Проверить агента
              </button>
            </div>
          </div>
        </div>
      </div>

      {showInstallGuide && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Инструкция по установке</h3>
              <button onClick={() => setShowInstallGuide(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <ol className="space-y-3 text-gray-600">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">1</span>
                <span>Скачайте APK файл по кнопке "Установить агент печати"</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">2</span>
                <span>В настройках Android разрешите установку из неизвестных источников</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">3</span>
                <span>Откройте скачанный файл и установите приложение</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">4</span>
                <span>Запустите приложение {agentSettings?.print_agent_name}</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">5</span>
                <span>Вернитесь в CRM и нажмите "Проверить агента"</span>
              </li>
            </ol>

            <button
              onClick={() => setShowInstallGuide(false)}
              className="w-full mt-6 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Понятно
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PrinterIcon className="w-5 h-5 text-gray-500" />
            <h3 className="font-semibold">Принтеры филиала</h3>
          </div>

          <button
            onClick={() => setShowNewPrinterForm(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Добавить принтер
          </button>
        </div>

        <div className="p-6">
          {showNewPrinterForm && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
                  <input
                    type="text"
                    value={newPrinter.name}
                    onChange={(e) => setNewPrinter(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Основной принтер"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IP адрес</label>
                  <input
                    type="text"
                    value={newPrinter.ip}
                    onChange={(e) => setNewPrinter(prev => ({ ...prev, ip: e.target.value }))}
                    placeholder="192.168.1.100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Порт</label>
                  <input
                    type="number"
                    value={newPrinter.port}
                    onChange={(e) => setNewPrinter(prev => ({ ...prev, port: parseInt(e.target.value) || 9100 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ширина бумаги</label>
                  <select
                    value={newPrinter.paper_width}
                    onChange={(e) => setNewPrinter(prev => ({ ...prev, paper_width: parseInt(e.target.value) as 58 | 80 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={58}>58mm</option>
                    <option value={80}>80mm</option>
                  </select>
                </div>
              </div>

              <p className="text-xs text-gray-500 mb-4">
                IP принтера должен быть статическим в локальной сети филиала.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={addPrinter}
                  disabled={saving || !newPrinter.name || !newPrinter.ip}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Добавить
                </button>
                <button
                  onClick={() => setShowNewPrinterForm(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          {printers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <PrinterIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Нет добавленных принтеров</p>
              <p className="text-sm">Добавьте принтер для печати чеков</p>
            </div>
          ) : (
            <div className="space-y-3">
              {printers.map(printer => (
                <div key={printer.id} className={`p-4 rounded-lg border ${
                  printer.enabled ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-60'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <PrinterIcon className={`w-5 h-5 ${printer.enabled ? 'text-gray-600' : 'text-gray-400'}`} />
                      <div>
                        <span className="font-medium">{printer.name}</span>
                        <div className="text-sm text-gray-500">
                          {printer.ip}:{printer.port} | {printer.paper_width}mm
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={printer.enabled}
                          onChange={() => togglePrinterEnabled(printer)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>

                      <button
                        onClick={() => deletePrinter(printer.id)}
                        className="p-1.5 text-red-400 hover:text-red-600 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {printer.enabled && (
                    <div className="flex gap-2 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => testPrinterConnection(printer)}
                        disabled={agentStatus !== 'online' || printerTests[printer.id] === 'testing'}
                        className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          printerTests[printer.id] === 'success'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : printerTests[printer.id] === 'error'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                        } disabled:opacity-50`}
                      >
                        {printerTests[printer.id] === 'testing' ? (
                          <><RefreshCw className="w-4 h-4 animate-spin" /> Проверка...</>
                        ) : printerTests[printer.id] === 'success' ? (
                          <><CheckCircle className="w-4 h-4" /> Принтер доступен</>
                        ) : printerTests[printer.id] === 'error' ? (
                          <><XCircle className="w-4 h-4" /> Принтер недоступен</>
                        ) : (
                          <><Wifi className="w-4 h-4" /> Проверить связь</>
                        )}
                      </button>

                      <button
                        onClick={() => printTestReceipt(printer)}
                        disabled={agentStatus !== 'online' || printerTests[printer.id] === 'testing'}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        <FileText className="w-4 h-4" />
                        Тестовая печать
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-500" />
            <h3 className="font-semibold">Автопечать</h3>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Печать включена</p>
              <p className="text-sm text-gray-500">Разрешить печать чеков для этого филиала</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={printSettings?.printing_enabled ?? false}
                onChange={(e) => setPrintSettings(prev => prev
                  ? { ...prev, printing_enabled: e.target.checked }
                  : { id: '', partner_id: partnerId, branch_id: selectedBranchId, printing_enabled: e.target.checked, auto_print_new_order: false, auto_print_statuses: [], default_printer_id: null, copies: 1, allowed_device_id: null, created_at: '', updated_at: '' }
                )}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Автопечать новых заказов</p>
              <p className="text-sm text-gray-500">Автоматически печатать при создании нового заказа</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={printSettings?.auto_print_new_order ?? false}
                onChange={(e) => setPrintSettings(prev => prev
                  ? { ...prev, auto_print_new_order: e.target.checked }
                  : null
                )}
                disabled={!printSettings?.printing_enabled}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
            </label>
          </div>

          <div>
            <p className="font-medium mb-2">Автопечать при смене статуса</p>
            <p className="text-sm text-gray-500 mb-3">Выберите статусы, при которых будет автоматически печататься чек</p>
            <div className="flex flex-wrap gap-2">
              {ORDER_STATUSES.map(status => (
                <label
                  key={status.value}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                    printSettings?.auto_print_statuses?.includes(status.value)
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  } ${!printSettings?.printing_enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={printSettings?.auto_print_statuses?.includes(status.value) ?? false}
                    onChange={(e) => {
                      if (!printSettings) return;
                      const statuses = e.target.checked
                        ? [...(printSettings.auto_print_statuses || []), status.value]
                        : (printSettings.auto_print_statuses || []).filter(s => s !== status.value);
                      setPrintSettings({ ...printSettings, auto_print_statuses: statuses });
                    }}
                    disabled={!printSettings?.printing_enabled}
                    className="sr-only"
                  />
                  {status.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Принтер по умолчанию</label>
              <select
                value={printSettings?.default_printer_id ?? ''}
                onChange={(e) => setPrintSettings(prev => prev
                  ? { ...prev, default_printer_id: e.target.value || null }
                  : null
                )}
                disabled={!printSettings?.printing_enabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              >
                <option value="">Не выбран</option>
                {printers.filter(p => p.enabled).map(printer => (
                  <option key={printer.id} value={printer.id}>{printer.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Количество копий</label>
              <input
                type="number"
                min={1}
                max={5}
                value={printSettings?.copies ?? 1}
                onChange={(e) => setPrintSettings(prev => prev
                  ? { ...prev, copies: Math.min(5, Math.max(1, parseInt(e.target.value) || 1)) }
                  : null
                )}
                disabled={!printSettings?.printing_enabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={savePrintSettings}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Сохранение...' : 'Сохранить настройки'}
            </button>
          </div>
        </div>
      </div>

      {agentStatus === 'offline' && printSettings?.printing_enabled && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Агент не установлен - печать невозможна</p>
            <p className="text-sm text-red-700">
              Установите и запустите {agentSettings?.print_agent_name} для работы печати чеков.
            </p>
          </div>
        </div>
      )}

      {agentStatus === 'online' && printers.filter(p => p.enabled).length === 0 && printSettings?.printing_enabled && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
          <PrinterIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">Нет активных принтеров</p>
            <p className="text-sm text-yellow-700">
              Добавьте и включите принтер для печати чеков.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
