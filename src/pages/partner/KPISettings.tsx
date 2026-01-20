import { useState, useEffect, useMemo } from 'react';
import { X, TrendingUp, Users, Award, AlertCircle, Building2, Briefcase, Check, Settings, Calendar, ArrowRight, ChevronRight, Copy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import PayrollPeriodsSettings from '../../components/PayrollPeriodsSettings';
import KPITemplateSettings from '../../components/KPITemplateSettings';
import KPIPeriodReport from '../../components/KPIPeriodReport';

interface Branch {
  id: string;
  name: string;
}

interface Position {
  id: string;
  name: string;
}

interface KPITemplate {
  id: string;
  branch_id: string;
  position_id: string;
  minimum_total_kpi_percent: number;
  branch_name: string;
  position_name: string;
  employee_count: number;
  indicator_count: number;
}

interface UnconfiguredPosition {
  branch_id: string;
  branch_name: string;
  position_id: string;
  position_name: string;
  employee_count: number;
}

interface KPISettingsProps {
  partnerId: string;
}

interface SelectedTemplate {
  templateId: string | null;
  branchId: string;
  positionId: string;
  branchName: string;
  positionName: string;
}

interface SelectedPeriodReport {
  periodId: string;
  periodStart: string;
  periodEnd: string;
  closedAt: string | null;
  status: string;
}

export default function KPISettings({ partnerId }: KPISettingsProps) {
  const [activeTab, setActiveTab] = useState<'payroll_periods' | 'templates'>('templates');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [kpiTemplates, setKPITemplates] = useState<KPITemplate[]>([]);
  const [unconfiguredPositions, setUnconfiguredPositions] = useState<UnconfiguredPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPeriods, setHasPeriods] = useState<boolean | null>(null);

  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [showBranchesModal, setShowBranchesModal] = useState(false);
  const [showPositionsModal, setShowPositionsModal] = useState(false);
  const [showUnconfigured, setShowUnconfigured] = useState(false);

  const [selectedTemplate, setSelectedTemplate] = useState<SelectedTemplate | null>(null);
  const [selectedPeriodReport, setSelectedPeriodReport] = useState<SelectedPeriodReport | null>(null);

  const [copyingFromTemplate, setCopyingFromTemplate] = useState<KPITemplate | null>(null);
  const [showCopyTargetModal, setShowCopyTargetModal] = useState(false);
  const [confirmCopyOverwrite, setConfirmCopyOverwrite] = useState<{ template: KPITemplate; target: KPITemplate } | null>(null);

  const [showEmployeesList, setShowEmployeesList] = useState<{ branchId: string; positionId: string } | null>(null);
  const [employeesList, setEmployeesList] = useState<any[]>([]);

  useEffect(() => {
    loadData();
    checkPeriods();
  }, [partnerId]);

  const checkPeriods = async () => {
    try {
      const { data, error } = await supabase
        .from('kpi_payroll_periods')
        .select('id')
        .eq('partner_id', partnerId)
        .limit(1);

      if (error) throw error;

      setHasPeriods(!!data && data.length > 0);
    } catch (error) {
      console.error('Error checking periods:', error);
      setHasPeriods(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const [branchesRes, positionsRes] = await Promise.all([
        supabase
          .from('branches')
          .select('id, name')
          .eq('partner_id', partnerId)
          .order('name'),
        supabase
          .from('positions')
          .select('id, name')
          .eq('partner_id', partnerId)
          .order('name')
      ]);

      if (branchesRes.error) throw branchesRes.error;
      if (positionsRes.error) throw positionsRes.error;

      setBranches(branchesRes.data || []);
      setPositions(positionsRes.data || []);

      await loadKPITemplates();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadKPITemplates = async () => {
    try {
      const { data: templates, error: templatesError } = await supabase
        .from('kpi_templates')
        .select(`
          id,
          branch_id,
          position_id,
          minimum_total_kpi_percent,
          branches!inner(name),
          positions!inner(name)
        `)
        .eq('partner_id', partnerId);

      if (templatesError) throw templatesError;

      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('position_id, branch_id')
        .eq('partner_id', partnerId)
        .is('dismissal_date', null);

      if (employeesError) throw employeesError;

      const { data: indicators, error: indicatorsError } = await supabase
        .from('kpi_template_sections')
        .select(`
          template_id,
          kpi_template_indicators!inner(
            id,
            is_enabled
          )
        `)
        .eq('partner_id', partnerId);

      if (indicatorsError) throw indicatorsError;

      const indicatorCounts = indicators?.reduce((acc: Record<string, number>, section: any) => {
        const templateId = section.template_id;
        const enabledCount = section.kpi_template_indicators?.filter((ind: any) => ind.is_enabled).length || 0;
        acc[templateId] = (acc[templateId] || 0) + enabledCount;
        return acc;
      }, {} as Record<string, number>) || {};

      const employeeCounts = employees?.reduce((acc: Record<string, number>, emp) => {
        const key = `${emp.branch_id}_${emp.position_id}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const enrichedTemplates = templates?.map((template: any) => ({
        id: template.id,
        branch_id: template.branch_id,
        position_id: template.position_id,
        minimum_total_kpi_percent: template.minimum_total_kpi_percent || 0,
        branch_name: template.branches.name,
        position_name: template.positions.name,
        employee_count: employeeCounts[`${template.branch_id}_${template.position_id}`] || 0,
        indicator_count: indicatorCounts[template.id] || 0,
      })) || [];

      setKPITemplates(enrichedTemplates);

      // Load unconfigured positions - load ALL positions including invisible ones
      const { data: allPositions, error: allPositionsError } = await supabase
        .from('positions')
        .select('id, name, is_visible')
        .eq('partner_id', partnerId);

      if (allPositionsError) throw allPositionsError;

      const { data: allBranches, error: allBranchesError } = await supabase
        .from('branches')
        .select('id, name')
        .eq('partner_id', partnerId);

      if (allBranchesError) throw allBranchesError;

      const configuredKeys = new Set(
        templates?.map((t: any) => `${t.branch_id}_${t.position_id}`) || []
      );

      const unconfigured: UnconfiguredPosition[] = [];
      allBranches?.forEach(branch => {
        allPositions?.forEach(position => {
          const key = `${branch.id}_${position.id}`;
          if (!configuredKeys.has(key)) {
            const empCount = employeeCounts[key] || 0;
            if (empCount > 0) {
              unconfigured.push({
                branch_id: branch.id,
                branch_name: branch.name,
                position_id: position.id,
                position_name: position.name,
                employee_count: empCount,
              });
            }
          }
        });
      });

      setUnconfiguredPositions(unconfigured);
    } catch (error) {
      console.error('Error loading KPI templates:', error);
    }
  };

  const filteredTemplates = useMemo(() => {
    let filtered = kpiTemplates;

    if (selectedBranches.length > 0) {
      filtered = filtered.filter(t => selectedBranches.includes(t.branch_id));
    }

    if (selectedPositions.length > 0) {
      filtered = filtered.filter(t => selectedPositions.includes(t.position_id));
    }

    const grouped = filtered.reduce((acc, template) => {
      if (!acc[template.branch_id]) {
        acc[template.branch_id] = {
          branchName: template.branch_name,
          templates: []
        };
      }
      acc[template.branch_id].templates.push(template);
      return acc;
    }, {} as Record<string, { branchName: string; templates: KPITemplate[] }>);

    return grouped;
  }, [kpiTemplates, selectedBranches, selectedPositions]);

  const toggleBranch = (branchId: string) => {
    setSelectedBranches(prev =>
      prev.includes(branchId)
        ? prev.filter(id => id !== branchId)
        : [...prev, branchId]
    );
  };

  const togglePosition = (positionId: string) => {
    setSelectedPositions(prev =>
      prev.includes(positionId)
        ? prev.filter(id => id !== positionId)
        : [...prev, positionId]
    );
  };

  const selectAllBranches = () => {
    setSelectedBranches(branches.map(b => b.id));
  };

  const clearAllBranches = () => {
    setSelectedBranches([]);
  };

  const selectAllPositions = () => {
    setSelectedPositions(positions.map(p => p.id));
  };

  const clearAllPositions = () => {
    setSelectedPositions([]);
  };

  const groupedUnconfigured = useMemo(() => {
    return unconfiguredPositions.reduce((acc, pos) => {
      if (!acc[pos.branch_id]) {
        acc[pos.branch_id] = {
          branchName: pos.branch_name,
          positions: []
        };
      }
      acc[pos.branch_id].positions.push(pos);
      return acc;
    }, {} as Record<string, { branchName: string; positions: UnconfiguredPosition[] }>);
  }, [unconfiguredPositions]);

  const handleTemplateSelect = (template: KPITemplate) => {
    setSelectedTemplate({
      templateId: template.id,
      branchId: template.branch_id,
      positionId: template.position_id,
      branchName: template.branch_name,
      positionName: template.position_name
    });
  };

  const handleUnconfiguredSelect = (pos: UnconfiguredPosition) => {
    setSelectedTemplate({
      templateId: null,
      branchId: pos.branch_id,
      positionId: pos.position_id,
      branchName: pos.branch_name,
      positionName: pos.position_name
    });
  };

  const handleBackFromTemplate = () => {
    setSelectedTemplate(null);
    loadKPITemplates();
  };

  const handleOpenPeriodReport = (period: SelectedPeriodReport) => {
    setSelectedPeriodReport(period);
  };

  const handleStartCopy = (e: React.MouseEvent, template: KPITemplate) => {
    e.stopPropagation();
    setCopyingFromTemplate(template);
    setShowCopyTargetModal(true);
  };

  const handleShowEmployees = async (e: React.MouseEvent, branchId: string, positionId: string) => {
    e.stopPropagation();

    // If already showing this list, close it
    if (showEmployeesList?.branchId === branchId && showEmployeesList?.positionId === positionId) {
      setShowEmployeesList(null);
      setEmployeesList([]);
      return;
    }

    // Open loading state first
    setShowEmployeesList({ branchId, positionId });
    setEmployeesList([]);

    try {
      const { data, error } = await supabase
        .from('schedule_shifts')
        .select('staff_member_id, staff_members(name)')
        .eq('partner_id', partnerId)
        .eq('branch_id', branchId)
        .eq('position_id', positionId)
        .distinct();

      if (error) throw error;

      const uniqueEmployees = Array.from(
        new Map(
          (data || []).map(item => [
            item.staff_member_id,
            {
              id: item.staff_member_id,
              name: item.staff_members?.name || 'Неизвестно'
            }
          ])
        ).values()
      );

      setEmployeesList(uniqueEmployees);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const handleCopyToTarget = async (target: KPITemplate | UnconfiguredPosition) => {
    if (!copyingFromTemplate) return;

    // Check if target is existing template
    const isExistingTemplate = 'id' in target;

    if (isExistingTemplate) {
      // Show confirmation
      setConfirmCopyOverwrite({
        template: copyingFromTemplate,
        target: target as KPITemplate
      });
      return;
    }

    // Copy to unconfigured position
    await performCopy(target.branch_id, target.position_id, null);
  };

  const handleConfirmOverwrite = async () => {
    if (!confirmCopyOverwrite) return;

    await performCopy(
      confirmCopyOverwrite.target.branch_id,
      confirmCopyOverwrite.target.position_id,
      confirmCopyOverwrite.target.id
    );

    setConfirmCopyOverwrite(null);
  };

  const performCopy = async (targetBranchId: string, targetPositionId: string, targetTemplateId: string | null) => {
    if (!copyingFromTemplate) return;

    try {
      // Load full template data
      const { data: sourceTemplate, error: templateError } = await supabase
        .from('kpi_templates')
        .select(`
          *,
          kpi_template_sections (
            *,
            kpi_template_indicators (*)
          )
        `)
        .eq('id', copyingFromTemplate.id)
        .single();

      if (templateError) throw templateError;

      // If target exists, delete it first
      if (targetTemplateId) {
        const { error: deleteError } = await supabase
          .from('kpi_templates')
          .delete()
          .eq('id', targetTemplateId);

        if (deleteError) throw deleteError;
      }

      // Create new template
      const { data: newTemplate, error: newTemplateError } = await supabase
        .from('kpi_templates')
        .insert({
          partner_id: partnerId,
          branch_id: targetBranchId,
          position_id: targetPositionId,
          minimum_total_kpi_percent: sourceTemplate.minimum_total_kpi_percent
        })
        .select()
        .single();

      if (newTemplateError) throw newTemplateError;

      // Copy sections and indicators
      for (const section of sourceTemplate.kpi_template_sections || []) {
        const { data: newSection, error: sectionError } = await supabase
          .from('kpi_template_sections')
          .insert({
            partner_id: partnerId,
            template_id: newTemplate.id,
            title: section.title,
            minimum_section_percent: section.minimum_section_percent
          })
          .select()
          .single();

        if (sectionError) throw sectionError;

        // Copy indicators
        const indicators = section.kpi_template_indicators?.map((ind: any) => ({
          partner_id: partnerId,
          section_id: newSection.id,
          indicator_key: ind.indicator_key,
          is_enabled: ind.is_enabled,
          minimum_indicator_percent: ind.minimum_indicator_percent,
          trigger_types: ind.trigger_types,
          trigger_limit: ind.trigger_limit
        })) || [];

        if (indicators.length > 0) {
          const { error: indicatorsError } = await supabase
            .from('kpi_template_indicators')
            .insert(indicators);

          if (indicatorsError) throw indicatorsError;
        }
      }

      // Reload data
      await loadKPITemplates();
      setCopyingFromTemplate(null);
      setShowCopyTargetModal(false);
      setConfirmCopyOverwrite(null);

    } catch (error) {
      console.error('Error copying template:', error);
      alert('Ошибка при копировании шаблона');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  if (selectedTemplate) {
    return (
      <KPITemplateSettings
        partnerId={partnerId}
        templateId={selectedTemplate.templateId}
        branchId={selectedTemplate.branchId}
        positionId={selectedTemplate.positionId}
        branchName={selectedTemplate.branchName}
        positionName={selectedTemplate.positionName}
        onBack={handleBackFromTemplate}
      />
    );
  }

  if (selectedPeriodReport) {
    return (
      <KPIPeriodReport
        partnerId={partnerId}
        periodId={selectedPeriodReport.periodId}
        periodStart={selectedPeriodReport.periodStart}
        periodEnd={selectedPeriodReport.periodEnd}
        closedAt={selectedPeriodReport.closedAt}
        status={selectedPeriodReport.status}
        onBack={() => setSelectedPeriodReport(null)}
      />
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent flex items-center gap-2">
              <Settings className="w-7 h-7 text-blue-600" />
              Настройки KPI
            </h2>
            <p className="text-gray-600 mt-2">
              Управление показателями эффективности и периодами выплат
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-6 py-3 font-medium transition-all relative ${
              activeTab === 'templates'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Шаблоны показателей
            {activeTab === 'templates' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('payroll_periods')}
            className={`px-6 py-3 font-medium transition-all relative ${
              activeTab === 'payroll_periods'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Периоды выплаты
            {activeTab === 'payroll_periods' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
            )}
          </button>
        </div>
      </div>

      {/* Payroll Periods Tab */}
      {activeTab === 'payroll_periods' && (
        <PayrollPeriodsSettings
          partnerId={partnerId}
          onPeriodsChange={checkPeriods}
          onOpenReport={(period) => handleOpenPeriodReport(period)}
        />
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div>
          {/* Warning if no periods */}
          {hasPeriods === false && (
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl shadow-lg border border-orange-200/50 p-12 mb-6">
              <div className="text-center max-w-2xl mx-auto">
                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Calendar className="w-10 h-10 text-orange-600" />
                </div>

                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  Сначала настройте периоды выплат
                </h3>

                <p className="text-gray-700 mb-8 text-lg">
                  Для создания шаблонов KPI необходимо сначала настроить расчетные периоды выплат.
                  Шаблоны показателей будут применяться к сотрудникам в рамках активного периода.
                </p>

                <button
                  onClick={() => setActiveTab('payroll_periods')}
                  className="px-8 py-4 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl hover:shadow-xl transition-all font-bold text-lg inline-flex items-center gap-3"
                >
                  <ArrowRight className="w-6 h-6" />
                  Перейти к настройке периодов
                </button>
              </div>
            </div>
          )}

          {hasPeriods && (
            <>
              <div className="mb-6 flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-6 h-6" />
                Шаблоны показателей
              </h3>
              <p className="text-gray-600 mt-1">
                Управление показателями эффективности по должностям и филиалам
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowBranchesModal(true)}
                className="px-4 py-2 rounded-xl font-medium flex items-center gap-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 transition-all"
              >
                <Building2 className="w-4 h-4" />
                Филиалы
                {selectedBranches.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-blue-600 text-white rounded-full text-xs font-semibold">
                    {selectedBranches.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setShowPositionsModal(true)}
                className="px-4 py-2 rounded-xl font-medium flex items-center gap-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 transition-all"
              >
                <Briefcase className="w-4 h-4" />
                Должности
                {selectedPositions.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-green-600 text-white rounded-full text-xs font-semibold">
                    {selectedPositions.length}
                  </span>
                )}
              </button>

              {unconfiguredPositions.length > 0 && (
                <button
                  onClick={() => setShowUnconfigured(!showUnconfigured)}
                  className={`px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all ${
                    showUnconfigured ? 'bg-orange-100 text-orange-700' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  <AlertCircle className="w-4 h-4" />
                  Не настроенные должности
                  <span className="ml-1 px-2 py-0.5 bg-orange-600 text-white rounded-full text-xs font-semibold">
                    {unconfiguredPositions.length}
                  </span>
                </button>
              )}
            </div>
          </div>

      {showBranchesModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Выбор филиалов
              </h3>
              <button
                onClick={() => setShowBranchesModal(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <span className="text-sm text-gray-600">
                Выбрано: <span className="font-semibold text-blue-600">{selectedBranches.length}</span> из {branches.length}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={selectAllBranches}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Выбрать все
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={clearAllBranches}
                  className="text-sm text-gray-600 hover:text-gray-700 font-medium"
                >
                  Очистить
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {branches.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Нет филиалов</p>
              ) : (
                <div className="space-y-2">
                  {branches.map(branch => (
                    <label
                      key={branch.id}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                        selectedBranches.includes(branch.id)
                          ? 'bg-blue-50 border-2 border-blue-500'
                          : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        <div
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                            selectedBranches.includes(branch.id)
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          {selectedBranches.includes(branch.id) && (
                            <Check className="w-3.5 h-3.5 text-white" />
                          )}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedBranches.includes(branch.id)}
                        onChange={() => toggleBranch(branch.id)}
                        className="sr-only"
                      />
                      <span className="flex-1 font-medium text-gray-900">{branch.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowBranchesModal(false)}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
              >
                Применить
              </button>
            </div>
          </div>
        </div>
      )}

      {showPositionsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Выбор должностей
              </h3>
              <button
                onClick={() => setShowPositionsModal(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <span className="text-sm text-gray-600">
                Выбрано: <span className="font-semibold text-green-600">{selectedPositions.length}</span> из {positions.length}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={selectAllPositions}
                  className="text-sm text-green-600 hover:text-green-700 font-medium"
                >
                  Выбрать все
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={clearAllPositions}
                  className="text-sm text-gray-600 hover:text-gray-700 font-medium"
                >
                  Очистить
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {positions.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Нет должностей</p>
              ) : (
                <div className="space-y-2">
                  {positions.map(position => (
                    <label
                      key={position.id}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                        selectedPositions.includes(position.id)
                          ? 'bg-green-50 border-2 border-green-500'
                          : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        <div
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                            selectedPositions.includes(position.id)
                              ? 'bg-green-600 border-green-600'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          {selectedPositions.includes(position.id) && (
                            <Check className="w-3.5 h-3.5 text-white" />
                          )}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedPositions.includes(position.id)}
                        onChange={() => togglePosition(position.id)}
                        className="sr-only"
                      />
                      <span className="flex-1 font-medium text-gray-900">{position.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowPositionsModal(false)}
                className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
              >
                Применить
              </button>
            </div>
          </div>
        </div>
      )}

      {showUnconfigured && (
        <div className="bg-orange-50/80 backdrop-blur-xl rounded-2xl shadow-lg border border-orange-200/50 mb-6">
          <div className="bg-gradient-to-r from-orange-600 to-amber-600 px-6 py-4 flex justify-between items-center">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Не настроенные должности ({unconfiguredPositions.length})
            </h3>
            <button
              onClick={() => setShowUnconfigured(false)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {Object.entries(groupedUnconfigured).map(([branchId, { branchName, positions: unconfigPositions }]) => (
            <div key={branchId} className="border-b border-orange-200 last:border-b-0">
              <div className="px-6 py-3 bg-orange-100/50">
                <h4 className="font-semibold text-orange-900">{branchName}</h4>
              </div>
              <div className="px-6 py-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {unconfigPositions.map(pos => (
                    <button
                      key={`${pos.branch_id}_${pos.position_id}`}
                      onClick={() => handleUnconfiguredSelect(pos)}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200 hover:border-orange-400 hover:bg-orange-50 transition-colors text-left"
                    >
                      <span className="font-medium text-gray-900">{pos.position_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-orange-100 text-orange-700 rounded-full font-semibold text-sm">
                          {pos.employee_count}
                        </span>
                        <ChevronRight className="w-4 h-4 text-orange-400" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

          <div className="space-y-6">
            {Object.entries(filteredTemplates).length === 0 ? (
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 p-12 text-center">
                <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">
                  {selectedBranches.length > 0 || selectedPositions.length > 0
                    ? 'Нет настроек KPI для выбранных фильтров'
                    : 'Нет настроенных показателей KPI'}
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  Создайте первый шаблон KPI для должности
                </p>
              </div>
            ) : (
              Object.entries(filteredTemplates).map(([branchId, { branchName, templates }]) => (
                <div key={branchId} className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Award className="w-5 h-5" />
                      {branchName}
                    </h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50/80">
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                            Должность
                          </th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">
                            <div className="flex items-center justify-center gap-2">
                              <Users className="w-4 h-4" />
                              Работников
                            </div>
                          </th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">
                            <div className="flex items-center justify-center gap-2">
                              <TrendingUp className="w-4 h-4" />
                              Показателей
                            </div>
                          </th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">
                            Минимальный %
                          </th>
                          <th className="px-6 py-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {templates.map(template => {
                          const isEmployeesOpen = showEmployeesList?.branchId === template.branch_id &&
                                                  showEmployeesList?.positionId === template.position_id;
                          return (
                            <>
                              <tr
                                key={template.id}
                                className={`hover:bg-blue-50/50 transition-colors cursor-pointer ${
                                  copyingFromTemplate?.id === template.id ? 'animate-marching-ants' : ''
                                }`}
                                onClick={() => handleTemplateSelect(template)}
                              >
                                <td className="px-6 py-4">
                                  <div className="font-medium text-gray-900">{template.position_name}</div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <button
                                    onClick={(e) => handleShowEmployees(e, template.branch_id, template.position_id)}
                                    className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-semibold transition-all ${
                                      isEmployeesOpen
                                        ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                    }`}
                                    title="Показать работников"
                                  >
                                    {template.employee_count}
                                  </button>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className="inline-flex items-center justify-center w-10 h-10 bg-green-100 text-green-700 rounded-full font-semibold">
                                    {template.indicator_count}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className="inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 rounded-lg font-bold text-lg">
                                    {template.minimum_total_kpi_percent}%
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={(e) => handleStartCopy(e, template)}
                                      className="p-2 hover:bg-blue-100 rounded-lg transition-colors text-blue-600"
                                      title="Копировать в должность"
                                    >
                                      <Copy className="w-5 h-5" />
                                    </button>
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                  </div>
                                </td>
                              </tr>
                              {isEmployeesOpen && (
                                <tr key={`${template.id}-employees`}>
                                  <td colSpan={5} className="px-6 py-4 bg-blue-50/30">
                                    {employeesList.length > 0 ? (
                                      <div className="max-h-64 overflow-y-auto">
                                        <div className="text-sm font-semibold text-gray-700 mb-3">
                                          Работники ({employeesList.length})
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                          {employeesList.map(emp => (
                                            <div
                                              key={emp.id}
                                              className="flex items-center gap-3 p-2 bg-white rounded-lg border border-blue-200"
                                            >
                                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                                                {emp.name?.charAt(0)?.toUpperCase() || '?'}
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <div className="font-medium text-gray-900 truncate">
                                                  {emp.name}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-center py-6 text-gray-500">
                                        <div className="text-sm">Нет работников</div>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
            </>
          )}
        </div>
      )}

      {/* Copy Target Selection Modal */}
      {showCopyTargetModal && copyingFromTemplate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Copy className="w-5 h-5" />
                Копировать настройки из: {copyingFromTemplate.branch_name} — {copyingFromTemplate.position_name}
              </h3>
              <button
                onClick={() => {
                  setCopyingFromTemplate(null);
                  setShowCopyTargetModal(false);
                }}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Unconfigured Positions */}
              {unconfiguredPositions.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                    Не настроенные должности
                  </h4>
                  {Object.entries(groupedUnconfigured).map(([branchId, { branchName, positions: unconfigPositions }]) => (
                    <div key={branchId} className="mb-4">
                      <div className="text-sm font-semibold text-gray-700 mb-2 px-2">
                        {branchName}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {unconfigPositions.map(pos => (
                          <button
                            key={`${pos.branch_id}_${pos.position_id}`}
                            onClick={() => handleCopyToTarget(pos)}
                            className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border-2 border-orange-200 hover:border-orange-400 hover:bg-orange-100 transition-all text-left"
                          >
                            <span className="font-medium text-gray-900">{pos.position_name}</span>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-8 h-8 bg-orange-200 text-orange-700 rounded-full font-semibold text-sm">
                                {pos.employee_count}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Existing Templates */}
              <div>
                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Настроенные должности
                </h4>
                {Object.entries(filteredTemplates).map(([branchId, { branchName, templates }]) => (
                  <div key={branchId} className="mb-4">
                    <div className="text-sm font-semibold text-gray-700 mb-2 px-2">
                      {branchName}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {templates
                        .filter(t => t.id !== copyingFromTemplate.id)
                        .map(template => (
                          <button
                            key={template.id}
                            onClick={() => handleCopyToTarget(template)}
                            className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-100 transition-all text-left"
                          >
                            <span className="font-medium text-gray-900">{template.position_name}</span>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-200 text-blue-700 rounded-full font-semibold text-sm">
                                {template.employee_count}
                              </span>
                            </div>
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overwrite Confirmation Modal */}
      {confirmCopyOverwrite && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-orange-600 px-6 py-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Подтверждение замены
              </h3>
            </div>

            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Вы собираетесь заменить все настройки KPI для должности:
              </p>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <div className="font-bold text-gray-900">
                  {confirmCopyOverwrite.target.branch_name} — {confirmCopyOverwrite.target.position_name}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {confirmCopyOverwrite.target.indicator_count} показателей, {confirmCopyOverwrite.target.employee_count} работников
                </div>
              </div>
              <p className="text-gray-700 mb-4">
                На настройки из:
              </p>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                <div className="font-bold text-gray-900">
                  {confirmCopyOverwrite.template.branch_name} — {confirmCopyOverwrite.template.position_name}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {confirmCopyOverwrite.template.indicator_count} показателей
                </div>
              </div>
              <p className="text-red-600 font-semibold">
                Все текущие настройки будут удалены и заменены. Это действие нельзя отменить.
              </p>
            </div>

            <div className="p-6 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setConfirmCopyOverwrite(null)}
                className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
              >
                Отмена
              </button>
              <button
                onClick={handleConfirmOverwrite}
                className="px-6 py-2 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
              >
                Подтвердить замену
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
