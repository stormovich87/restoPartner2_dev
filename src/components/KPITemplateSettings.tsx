import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Settings,
  Minus,
  Plus,
  Check,
  ChevronDown,
  ChevronRight,
  Trash2,
  X,
  Target,
  Calendar,
  Clock,
  AlertTriangle,
  Users,
  Info,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface KPITemplateSettingsProps {
  partnerId: string;
  templateId: string | null;
  branchId: string;
  positionId: string;
  branchName: string;
  positionName: string;
  onBack: () => void;
}

interface ActivePeriod {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
}

interface Section {
  id: string;
  title: string;
  sort_order: number;
  minimum_section_percent: number;
  indicators: Indicator[];
}

interface Indicator {
  id: string;
  indicator_key: string;
  sort_order: number;
  is_enabled: boolean;
  minimum_indicator_percent: number;
  trigger_types: string[];
  trigger_limit: number;
  late_threshold_minutes: number;
}

const SECTION_TYPES = [
  { key: 'hr_indicator', title: 'HR индикатор' }
];

const INDICATOR_TYPES = [
  { key: 'punctuality', title: 'Прогулы', icon: AlertTriangle },
  { key: 'late_arrivals', title: 'Опоздания', icon: Clock },
  { key: 'shift_confirmation', title: 'Подтверждение смен', icon: Check }
];

const TRIGGER_TYPES = [
  { key: 'no_show', label: 'Прогулы' },
  { key: 'late', label: 'Опоздания' },
  { key: 'unconfirmed_open_shift', label: 'Неподтвержденные открытые смены' },
  { key: 'unconfirmed_closed_shift', label: 'Неподтвержденные закрытые смены' }
];

export default function KPITemplateSettings({
  partnerId,
  templateId: initialTemplateId,
  branchId,
  positionId,
  branchName,
  positionName,
  onBack
}: KPITemplateSettingsProps) {
  const [templateId, setTemplateId] = useState<string | null>(initialTemplateId);
  const [minimumTotalKPI, setMinimumTotalKPI] = useState(0);
  const [sections, setSections] = useState<Section[]>([]);
  const [activePeriod, setActivePeriod] = useState<ActivePeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | null>(null);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedIndicators, setExpandedIndicators] = useState<Set<string>>(new Set());

  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [showAddIndicatorModal, setShowAddIndicatorModal] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'section' | 'indicator'; id: string } | null>(null);
  const [showDeleteTemplateModal, setShowDeleteTemplateModal] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);

  useEffect(() => {
    loadData();
  }, [partnerId, branchId, positionId]);

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: period } = await supabase
        .from('kpi_payroll_periods')
        .select('id, period_start, period_end, status')
        .eq('partner_id', partnerId)
        .eq('status', 'active')
        .maybeSingle();

      setActivePeriod(period);

      let currentTemplateId = templateId;

      if (!currentTemplateId) {
        const { data: existingTemplate } = await supabase
          .from('kpi_templates')
          .select('id, minimum_total_kpi_percent')
          .eq('partner_id', partnerId)
          .eq('branch_id', branchId)
          .eq('position_id', positionId)
          .maybeSingle();

        if (existingTemplate) {
          currentTemplateId = existingTemplate.id;
          setTemplateId(existingTemplate.id);
          setMinimumTotalKPI(existingTemplate.minimum_total_kpi_percent || 0);
        } else {
          const { data: newTemplate, error: createError } = await supabase
            .from('kpi_templates')
            .insert({
              partner_id: partnerId,
              branch_id: branchId,
              position_id: positionId,
              minimum_total_kpi_percent: 0,
              pass_threshold_percent: 72
            })
            .select('id')
            .single();

          if (createError) throw createError;
          currentTemplateId = newTemplate.id;
          setTemplateId(newTemplate.id);
          setMinimumTotalKPI(0);
        }
      } else {
        const { data: template } = await supabase
          .from('kpi_templates')
          .select('minimum_total_kpi_percent')
          .eq('id', currentTemplateId)
          .single();

        if (template) {
          setMinimumTotalKPI(template.minimum_total_kpi_percent || 0);
        }
      }

      if (currentTemplateId) {
        const { data: sectionsData } = await supabase
          .from('kpi_template_sections')
          .select(`
            id,
            title,
            sort_order,
            minimum_section_percent,
            kpi_template_indicators (
              id,
              indicator_key,
              sort_order,
              is_enabled,
              minimum_indicator_percent,
              trigger_types,
              trigger_limit,
              late_threshold_minutes
            )
          `)
          .eq('template_id', currentTemplateId)
          .order('sort_order');

        if (sectionsData) {
          const formattedSections = sectionsData.map((s: any) => ({
            id: s.id,
            title: s.title,
            sort_order: s.sort_order,
            minimum_section_percent: s.minimum_section_percent || 0,
            indicators: (s.kpi_template_indicators || []).map((i: any) => ({
              id: i.id,
              indicator_key: i.indicator_key,
              sort_order: i.sort_order,
              is_enabled: i.is_enabled,
              minimum_indicator_percent: i.minimum_indicator_percent || 0,
              trigger_types: i.trigger_types || [],
              trigger_limit: i.trigger_limit || 4,
              late_threshold_minutes: i.late_threshold_minutes || 0
            }))
          }));
          setSections(formattedSections);

          if (formattedSections.length > 0) {
            setExpandedSections(new Set([formattedSections[0].id]));
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const autoSave = async (updates: any, table: string, id: string) => {
    setSaving(true);
    setSaveStatus('saving');
    try {
      const { error } = await supabase
        .from(table)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (error) {
      console.error('Error saving:', error);
      setSaveStatus(null);
    } finally {
      setSaving(false);
    }
  };

  const handleMinimumTotalKPIChange = (delta: number) => {
    const newValue = Math.max(0, Math.min(100, minimumTotalKPI + delta));
    setMinimumTotalKPI(newValue);
    if (templateId) {
      autoSave({ minimum_total_kpi_percent: newValue }, 'kpi_templates', templateId);
    }
  };

  const handleSectionMinimumChange = (sectionId: string, delta: number) => {
    setSections(prev => prev.map(s => {
      if (s.id === sectionId) {
        const newValue = Math.max(0, Math.min(100, s.minimum_section_percent + delta));
        autoSave({ minimum_section_percent: newValue }, 'kpi_template_sections', sectionId);
        return { ...s, minimum_section_percent: newValue };
      }
      return s;
    }));
  };

  const handleIndicatorMinimumChange = (indicatorId: string, delta: number) => {
    setSections(prev => prev.map(s => ({
      ...s,
      indicators: s.indicators.map(i => {
        if (i.id === indicatorId) {
          const newValue = Math.max(0, Math.min(100, i.minimum_indicator_percent + delta));
          autoSave({ minimum_indicator_percent: newValue }, 'kpi_template_indicators', indicatorId);
          return { ...i, minimum_indicator_percent: newValue };
        }
        return i;
      })
    })));
  };

  const handleTriggerLimitChange = (indicatorId: string, delta: number) => {
    setSections(prev => prev.map(s => ({
      ...s,
      indicators: s.indicators.map(i => {
        if (i.id === indicatorId) {
          const newValue = Math.max(0, i.trigger_limit + delta);
          autoSave({ trigger_limit: newValue }, 'kpi_template_indicators', indicatorId);
          return { ...i, trigger_limit: newValue };
        }
        return i;
      })
    })));
  };

  const handleLateThresholdChange = (indicatorId: string, delta: number) => {
    setSections(prev => prev.map(s => ({
      ...s,
      indicators: s.indicators.map(i => {
        if (i.id === indicatorId) {
          const newValue = Math.max(0, i.late_threshold_minutes + delta);
          autoSave({ late_threshold_minutes: newValue }, 'kpi_template_indicators', indicatorId);
          return { ...i, late_threshold_minutes: newValue };
        }
        return i;
      })
    })));
  };

  const handleTriggerTypeToggle = (indicatorId: string, triggerType: string) => {
    setSections(prev => prev.map(s => ({
      ...s,
      indicators: s.indicators.map(i => {
        if (i.id === indicatorId) {
          const newTypes = i.trigger_types.includes(triggerType)
            ? i.trigger_types.filter(t => t !== triggerType)
            : [...i.trigger_types, triggerType];
          autoSave({ trigger_types: newTypes }, 'kpi_template_indicators', indicatorId);
          return { ...i, trigger_types: newTypes };
        }
        return i;
      })
    })));
  };

  const addSection = async (sectionKey: string) => {
    if (!templateId) return;

    const sectionType = SECTION_TYPES.find(s => s.key === sectionKey);
    if (!sectionType) return;

    try {
      const { data: newSection, error } = await supabase
        .from('kpi_template_sections')
        .insert({
          partner_id: partnerId,
          template_id: templateId,
          title: sectionType.title,
          sort_order: sections.length + 1,
          minimum_section_percent: 0
        })
        .select('id, title, sort_order, minimum_section_percent')
        .single();

      if (error) throw error;

      setSections(prev => [...prev, {
        ...newSection,
        indicators: []
      }]);
      setExpandedSections(prev => new Set([...prev, newSection.id]));
      setShowAddSectionModal(false);
    } catch (error) {
      console.error('Error adding section:', error);
    }
  };

  const addIndicator = async (sectionId: string, indicatorKey: string) => {
    try {
      const section = sections.find(s => s.id === sectionId);
      if (!section) return;

      // Set default trigger types based on indicator
      let defaultTriggerTypes: string[] = [];
      if (indicatorKey === 'punctuality') {
        defaultTriggerTypes = ['no_show'];
      } else if (indicatorKey === 'late_arrivals') {
        defaultTriggerTypes = ['late'];
      } else if (indicatorKey === 'shift_confirmation') {
        defaultTriggerTypes = ['unconfirmed_open_shift', 'unconfirmed_closed_shift'];
      }

      const { data: newIndicator, error } = await supabase
        .from('kpi_template_indicators')
        .insert({
          partner_id: partnerId,
          section_id: sectionId,
          indicator_key: indicatorKey,
          sort_order: section.indicators.length + 1,
          is_enabled: true,
          minimum_indicator_percent: 0,
          trigger_types: defaultTriggerTypes,
          trigger_limit: 4,
          late_threshold_minutes: 0
        })
        .select('id, indicator_key, sort_order, is_enabled, minimum_indicator_percent, trigger_types, trigger_limit, late_threshold_minutes')
        .single();

      if (error) throw error;

      setSections(prev => prev.map(s => {
        if (s.id === sectionId) {
          return {
            ...s,
            indicators: [...s.indicators, newIndicator]
          };
        }
        return s;
      }));
      setExpandedIndicators(prev => new Set([...prev, newIndicator.id]));
      setShowAddIndicatorModal(null);
    } catch (error) {
      console.error('Error adding indicator:', error);
    }
  };

  const deleteSection = async (sectionId: string) => {
    try {
      await supabase
        .from('kpi_template_indicators')
        .delete()
        .eq('section_id', sectionId);

      const { error } = await supabase
        .from('kpi_template_sections')
        .delete()
        .eq('id', sectionId);

      if (error) throw error;

      setSections(prev => prev.filter(s => s.id !== sectionId));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting section:', error);
    }
  };

  const deleteIndicator = async (indicatorId: string) => {
    try {
      const { error } = await supabase
        .from('kpi_template_indicators')
        .delete()
        .eq('id', indicatorId);

      if (error) throw error;

      setSections(prev => prev.map(s => ({
        ...s,
        indicators: s.indicators.filter(i => i.id !== indicatorId)
      })));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting indicator:', error);
    }
  };

  const deleteTemplate = async () => {
    if (!templateId) return;

    try {
      setDeletingTemplate(true);

      for (const section of sections) {
        await supabase
          .from('kpi_template_indicators')
          .delete()
          .eq('section_id', section.id);
      }

      const { error: sectionsError } = await supabase
        .from('kpi_template_sections')
        .delete()
        .eq('template_id', templateId);

      if (sectionsError) throw sectionsError;

      const { error: templateError } = await supabase
        .from('kpi_templates')
        .delete()
        .eq('id', templateId);

      if (templateError) throw templateError;

      setShowDeleteTemplateModal(false);
      onBack();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Ошибка при удалении настроек KPI');
    } finally {
      setDeletingTemplate(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const toggleIndicator = (indicatorId: string) => {
    setExpandedIndicators(prev => {
      const next = new Set(prev);
      if (next.has(indicatorId)) {
        next.delete(indicatorId);
      } else {
        next.add(indicatorId);
      }
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getIndicatorTitle = (key: string) => {
    return INDICATOR_TYPES.find(i => i.key === key)?.title || key;
  };

  const getActiveTriggerLabels = (types: string[]) => {
    return types.map(t => TRIGGER_TYPES.find(tt => tt.key === t)?.label || t).join(', ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-7 h-7 text-blue-600" />
            Настройки работы KPI
          </h2>
          <p className="text-gray-600 mt-1">
            {positionName} — {branchName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus && (
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              saveStatus === 'saving' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
            }`}>
              {saveStatus === 'saving' ? 'Сохранение...' : 'Сохранено'}
            </div>
          )}
          {templateId && (
            <button
              onClick={() => setShowDeleteTemplateModal(true)}
              className="p-2 hover:bg-red-50 rounded-xl transition-colors text-red-600"
              title="Удалить настройки KPI"
            >
              <Trash2 className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>

      {activePeriod && (
        <button
          onClick={onBack}
          className="w-full text-left px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
        >
          <div className="flex items-center gap-2 text-blue-700">
            <Calendar className="w-4 h-4" />
            <span className="font-medium">Активный период:</span>
            <span>{formatDate(activePeriod.period_start)} — {formatDate(activePeriod.period_end)}</span>
            <ChevronRight className="w-4 h-4 ml-auto" />
          </div>
        </button>
      )}

      <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-8">
        <div className="text-center">
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Минимальный итоговый средний процент KPI
          </h3>
          <p className="text-sm text-gray-500 mb-6 max-w-lg mx-auto">
            Если итоговый KPI сотрудника за период ниже этого процента — сотруднику начисляется 0 за KPI.
          </p>

          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => handleMinimumTotalKPIChange(-1)}
              disabled={minimumTotalKPI <= 0}
              className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <Minus className="w-6 h-6 text-gray-600" />
            </button>

            <div className="text-5xl font-bold text-gray-900">
              {minimumTotalKPI}%
            </div>

            <button
              onClick={() => handleMinimumTotalKPIChange(1)}
              disabled={minimumTotalKPI >= 100}
              className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <Plus className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Разделы KPI</h3>
          <button
            onClick={() => setShowAddSectionModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Добавить раздел KPI
          </button>
        </div>

        {sections.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl p-12 text-center">
            <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Нет разделов KPI</p>
            <p className="text-gray-400 text-sm mt-1">Добавьте первый раздел для начала работы</p>
          </div>
        ) : (
          sections.map(section => (
            <div
              key={section.id}
              className="bg-cyan-50 border border-cyan-200 rounded-2xl overflow-hidden"
            >
              <div
                className="px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-cyan-100 transition-colors"
                onClick={() => toggleSection(section.id)}
              >
                {expandedSections.has(section.id) ? (
                  <ChevronDown className="w-5 h-5 text-cyan-600" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-cyan-600" />
                )}

                <div className="flex-1">
                  <h4 className="font-bold text-gray-900">{section.title}</h4>
                  <p className="text-sm text-gray-600">
                    Количество показателей: {section.indicators.filter(i => i.is_enabled).length}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSectionMinimumChange(section.id, -1);
                    }}
                    className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center transition-colors"
                  >
                    <Minus className="w-4 h-4 text-gray-600" />
                  </button>
                  <span className="px-3 py-1 bg-cyan-600 text-white rounded-full font-bold text-sm min-w-[60px] text-center">
                    {section.minimum_section_percent}%
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSectionMinimumChange(section.id, 1);
                    }}
                    className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-4 h-4 text-gray-600" />
                  </button>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm({ type: 'section', id: section.id });
                  }}
                  className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-500"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {expandedSections.has(section.id) && (
                <div className="px-6 pb-6 space-y-4">
                  <div className="bg-white/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <Info className="w-4 h-4" />
                      <span>Минимальный процент раздела</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Если итоговый процент раздела ниже этого значения — раздел считается 0%.
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-b border-cyan-200 pb-3">
                    <span className="font-medium text-gray-700">Показатели (HR)</span>
                    <span className="font-medium text-gray-700 text-sm">Минимальный % для показателя</span>
                  </div>

                  {section.indicators.length === 0 ? (
                    <p className="text-gray-500 text-sm py-4 text-center">Нет показателей в разделе</p>
                  ) : (
                    section.indicators.map(indicator => (
                      <div key={indicator.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div
                          className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => toggleIndicator(indicator.id)}
                        >
                          {expandedIndicators.has(indicator.id) ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}

                          <Clock className="w-5 h-5 text-blue-600" />
                          <span className="flex-1 font-medium text-gray-900">
                            {getIndicatorTitle(indicator.indicator_key)}
                          </span>

                          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-bold text-sm">
                            {indicator.minimum_indicator_percent}%
                          </span>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm({ type: 'indicator', id: indicator.id });
                            }}
                            className="p-1 hover:bg-red-100 rounded-lg transition-colors text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {expandedIndicators.has(indicator.id) && (
                          <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-6">
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2">Минимальный проходной процент</h5>
                              <div className="flex items-center gap-4">
                                <button
                                  onClick={() => handleIndicatorMinimumChange(indicator.id, -1)}
                                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                >
                                  <Minus className="w-5 h-5 text-gray-600" />
                                </button>
                                <span className="text-2xl font-bold text-gray-900 min-w-[80px] text-center">
                                  {indicator.minimum_indicator_percent}%
                                </span>
                                <button
                                  onClick={() => handleIndicatorMinimumChange(indicator.id, 1)}
                                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                >
                                  <Plus className="w-5 h-5 text-gray-600" />
                                </button>
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                Если рассчитанный процент показателя ниже этого значения — показатель становится 0%.
                              </p>
                            </div>

                            {indicator.indicator_key === 'shift_confirmation' ? (
                              <div>
                                <h5 className="font-medium text-gray-900 mb-3">Триггеры показателя</h5>
                                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                                  <p className="text-sm text-gray-700 mb-2">
                                    <strong>Автоматически включены:</strong>
                                  </p>
                                  <ul className="space-y-2">
                                    <li className="flex items-center gap-2 text-sm text-gray-700">
                                      <Check className="w-4 h-4 text-blue-600" />
                                      <span>Неподтвержденные открытые смены</span>
                                    </li>
                                    <li className="flex items-center gap-2 text-sm text-gray-700">
                                      <Check className="w-4 h-4 text-blue-600" />
                                      <span>Неподтвержденные закрытые смены</span>
                                    </li>
                                  </ul>
                                  <p className="text-xs text-gray-500 mt-3">
                                    Триггеры этого показателя фиксированы и не могут быть изменены.
                                  </p>
                                </div>
                              </div>
                            ) : indicator.indicator_key === 'punctuality' ? (
                              <div>
                                <h5 className="font-medium text-gray-900 mb-3">Триггеры показателя</h5>
                                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                                  <p className="text-sm text-gray-700 mb-2">
                                    <strong>Автоматически включен:</strong>
                                  </p>
                                  <ul className="space-y-2">
                                    <li className="flex items-center gap-2 text-sm text-gray-700">
                                      <Check className="w-4 h-4 text-blue-600" />
                                      <span>Прогулы</span>
                                    </li>
                                  </ul>
                                  <p className="text-xs text-gray-500 mt-3">
                                    Триггер этого показателя фиксирован и не может быть изменен.
                                  </p>
                                </div>
                              </div>
                            ) : indicator.indicator_key === 'late_arrivals' ? (
                              <div className="space-y-4">
                                <div>
                                  <h5 className="font-medium text-gray-900 mb-3">Триггеры показателя</h5>
                                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                                    <p className="text-sm text-gray-700 mb-2">
                                      <strong>Автоматически включен:</strong>
                                    </p>
                                    <ul className="space-y-2">
                                      <li className="flex items-center gap-2 text-sm text-gray-700">
                                        <Check className="w-4 h-4 text-blue-600" />
                                        <span>Опоздания</span>
                                      </li>
                                    </ul>
                                    <p className="text-xs text-gray-500 mt-3">
                                      Триггер этого показателя фиксирован и не может быть изменен.
                                    </p>
                                  </div>
                                </div>
                                <div>
                                  <h5 className="font-medium text-gray-900 mb-3">От скольки минут опоздания срабатывает триггер</h5>
                                  <div className="flex items-center gap-4">
                                    <button
                                      onClick={() => handleLateThresholdChange(indicator.id, -1)}
                                      className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                    >
                                      <Minus className="w-5 h-5 text-gray-600" />
                                    </button>
                                    <span className="text-2xl font-bold text-gray-900 min-w-[60px] text-center">
                                      {indicator.late_threshold_minutes}
                                    </span>
                                    <button
                                      onClick={() => handleLateThresholdChange(indicator.id, 1)}
                                      className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                    >
                                      <Plus className="w-5 h-5 text-gray-600" />
                                    </button>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-2">
                                    Минимальное количество минут опоздания для срабатывания триггера. 0 означает, что любое опоздание считается.
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <h5 className="font-medium text-gray-900 mb-3">Триггеры показателя</h5>
                                <div className="space-y-2">
                                  {TRIGGER_TYPES.filter(t =>
                                    t.key !== 'unconfirmed_open_shift' && t.key !== 'unconfirmed_closed_shift'
                                  ).map(trigger => (
                                    <label
                                      key={trigger.key}
                                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                      <div
                                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                          indicator.trigger_types.includes(trigger.key)
                                            ? 'bg-blue-600 border-blue-600'
                                            : 'border-gray-300 bg-white'
                                        }`}
                                        onClick={() => handleTriggerTypeToggle(indicator.id, trigger.key)}
                                      >
                                        {indicator.trigger_types.includes(trigger.key) && (
                                          <Check className="w-3 h-3 text-white" />
                                        )}
                                      </div>
                                      <span className="font-medium text-gray-900">{trigger.label}</span>
                                    </label>
                                  ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                  Если включено — при каждом случае в графике работы фиксируется срабатывание триггера для сотрудников этой должности.
                                </p>
                              </div>
                            )}

                            <div>
                              <h5 className="font-medium text-gray-900 mb-3">Лимит триггеров за активный период</h5>
                              <div className="flex items-center gap-4">
                                <button
                                  onClick={() => handleTriggerLimitChange(indicator.id, -1)}
                                  disabled={indicator.trigger_limit <= 0}
                                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50 flex items-center justify-center transition-colors"
                                >
                                  <Minus className="w-5 h-5 text-gray-600" />
                                </button>
                                <span className="text-2xl font-bold text-gray-900 min-w-[60px] text-center">
                                  {indicator.trigger_limit}
                                </span>
                                <button
                                  onClick={() => handleTriggerLimitChange(indicator.id, 1)}
                                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                >
                                  <Plus className="w-5 h-5 text-gray-600" />
                                </button>
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                Лимит применяется к активному периоду выплат. Каждый триггер уменьшает показатель на шаг 100/лимит.
                              </p>

                              {indicator.trigger_types.length > 0 && (
                                <div className="mt-3 p-3 bg-gray-50 rounded-xl">
                                  <span className="text-sm text-gray-700">
                                    <strong>Активно:</strong> {getActiveTriggerLabels(indicator.trigger_types)}
                                  </span>
                                </div>
                              )}
                            </div>

                            {activePeriod && (
                              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                                <div className="flex items-center gap-2 text-blue-700 mb-2">
                                  <Calendar className="w-4 h-4" />
                                  <span className="font-medium">
                                    Считается за активный период: {formatDate(activePeriod.period_start)} — {formatDate(activePeriod.period_end)}
                                  </span>
                                </div>
                                <div className="flex items-start gap-2 text-sm text-blue-600 bg-blue-100 p-3 rounded-lg">
                                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                  <span>
                                    Если лимит = {indicator.trigger_limit}, шаг = {indicator.trigger_limit > 0 ? Math.round(100 / indicator.trigger_limit) : 0}%.
                                    Каждый триггер уменьшает показатель: 100 → {indicator.trigger_limit > 0 ?
                                      Array.from({ length: Math.min(indicator.trigger_limit, 4) }, (_, i) =>
                                        Math.max(0, 100 - (i + 1) * Math.round(100 / indicator.trigger_limit))
                                      ).join(' → ') + (indicator.trigger_limit > 0 ? ' → 0' : '')
                                      : '0'
                                    }.
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}

                  <button
                    onClick={() => setShowAddIndicatorModal(section.id)}
                    className="w-full py-3 border-2 border-dashed border-cyan-300 rounded-xl text-cyan-600 hover:bg-cyan-100 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Добавить показатель
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showAddSectionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Добавить раздел KPI</h3>
              <button
                onClick={() => setShowAddSectionModal(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {SECTION_TYPES.filter(st => !sections.find(s => s.title === st.title)).map(sectionType => (
                <button
                  key={sectionType.key}
                  onClick={() => addSection(sectionType.key)}
                  className="w-full p-4 text-left bg-gray-50 hover:bg-blue-50 rounded-xl transition-colors border border-gray-200 hover:border-blue-300"
                >
                  <span className="font-medium text-gray-900">{sectionType.title}</span>
                </button>
              ))}
              {SECTION_TYPES.filter(st => !sections.find(s => s.title === st.title)).length === 0 && (
                <p className="text-gray-500 text-center py-4">Все разделы уже добавлены</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddIndicatorModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Добавить показатель</h3>
              <button
                onClick={() => setShowAddIndicatorModal(null)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {(() => {
                const section = sections.find(s => s.id === showAddIndicatorModal);
                const availableIndicators = INDICATOR_TYPES.filter(
                  it => !section?.indicators.find(i => i.indicator_key === it.key)
                );

                return availableIndicators.length > 0 ? (
                  availableIndicators.map(indicatorType => (
                    <button
                      key={indicatorType.key}
                      onClick={() => addIndicator(showAddIndicatorModal, indicatorType.key)}
                      className="w-full p-4 text-left bg-gray-50 hover:bg-blue-50 rounded-xl transition-colors border border-gray-200 hover:border-blue-300 flex items-center gap-3"
                    >
                      <indicatorType.icon className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-gray-900">{indicatorType.title}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">Все показатели уже добавлены</p>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
                Удалить {deleteConfirm.type === 'section' ? 'раздел' : 'показатель'}?
              </h3>
              <p className="text-gray-500 text-center text-sm mb-6">
                {deleteConfirm.type === 'section'
                  ? 'Все показатели в разделе также будут удалены.'
                  : 'Это действие нельзя отменить.'
                }
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={() => deleteConfirm.type === 'section'
                    ? deleteSection(deleteConfirm.id)
                    : deleteIndicator(deleteConfirm.id)
                  }
                  className="flex-1 py-2 px-4 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteTemplateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 text-center mb-3">
                Удалить настройки KPI?
              </h3>
              <p className="text-gray-600 text-center mb-2">
                Вы собираетесь удалить все настройки KPI для должности:
              </p>
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-center font-medium text-gray-900">
                  {positionName} — {branchName}
                </p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-6">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-orange-800">
                    <p className="font-medium mb-1">Последствия удаления:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Будут удалены все разделы и показатели KPI</li>
                      <li>У работников этой должности перестанет отображаться KPI</li>
                      <li>Данные можно будет восстановить только путем повторной настройки</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteTemplateModal(false)}
                  disabled={deletingTemplate}
                  className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Отмена
                </button>
                <button
                  onClick={deleteTemplate}
                  disabled={deletingTemplate}
                  className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deletingTemplate ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Удаление...
                    </>
                  ) : (
                    'Удалить навсегда'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
