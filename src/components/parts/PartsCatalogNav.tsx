"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Wrench, Package } from "lucide-react";

export interface CatalogTreeNode {
  id: string;
  code: string;
  nameZh: string;
  nameEn: string;
  sortOrder: number;
  subSystems: {
    id: string;
    code: string;
    nameZh: string;
    nameEn: string;
    sortOrder: number;
    componentGroups: {
      id: string;
      code: string;
      nameZh: string;
      nameEn: string;
      sortOrder: number;
      partCount: number;
    }[];
  }[];
}

interface PartsCatalogNavProps {
  catalogTree: CatalogTreeNode[];
  selectedMachineType: string | null;
  selectedSubSystem: string | null;
  selectedComponentGroup: string | null;
  onSelect: (machineType: string | null, subSystem: string | null, componentGroup: string | null) => void;
  locale: string;
}

export default function PartsCatalogNav({
  catalogTree,
  selectedMachineType,
  selectedSubSystem,
  selectedComponentGroup,
  onSelect,
  locale,
}: PartsCatalogNavProps) {
  const isZh = locale === "zh";
  const [expandedMachineTypes, setExpandedMachineTypes] = useState<Set<string>>(
    new Set(selectedMachineType ? [selectedMachineType] : [])
  );
  const [expandedSubSystems, setExpandedSubSystems] = useState<Set<string>>(
    new Set(selectedSubSystem ? [selectedSubSystem] : [])
  );

  const toggleMachineType = (code: string) => {
    setExpandedMachineTypes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const toggleSubSystem = (key: string) => {
    setExpandedSubSystems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleMachineTypeClick = (code: string) => {
    onSelect(code, null, null);
    if (!expandedMachineTypes.has(code)) {
      toggleMachineType(code);
    }
  };

  const handleSubSystemClick = (mtCode: string, ssCode: string) => {
    onSelect(mtCode, ssCode, null);
    const key = `${mtCode}:${ssCode}`;
    if (!expandedSubSystems.has(key)) {
      toggleSubSystem(key);
    }
  };

  const handleComponentGroupClick = (mtCode: string, ssCode: string, cgCode: string) => {
    onSelect(mtCode, ssCode, cgCode);
  };

  return (
    <nav className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
        <Package className="h-4 w-4 text-orange-600" />
        <span className="font-semibold text-sm text-gray-800">
          {isZh ? "配件分类" : "Parts Catalog"}
        </span>
      </div>
      <div className="max-h-[calc(100vh-300px)] overflow-y-auto py-2">
        {/* 全部配件 */}
        <button
          onClick={() => onSelect(null, null, null)}
          className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
            !selectedMachineType
              ? "bg-orange-50 text-orange-700 font-medium"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Wrench className="h-3.5 w-3.5" />
          {isZh ? "全部配件" : "All Parts"}
        </button>

        {/* 整机品类列表 */}
        {catalogTree.map((mt) => {
          const mtExpanded = expandedMachineTypes.has(mt.code);
          const mtSelected = selectedMachineType === mt.code;
          const hasSubSystems = mt.subSystems.length > 0;

          return (
            <div key={mt.id}>
              <div
                className={`flex items-center px-4 py-2 text-sm cursor-pointer transition-colors ${
                  mtSelected && !selectedSubSystem
                    ? "bg-orange-50 text-orange-700 font-medium"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => handleMachineTypeClick(mt.code)}
              >
                {hasSubSystems && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMachineType(mt.code);
                    }}
                    className="flex-shrink-0 mr-1"
                  >
                    {mtExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                    )}
                  </button>
                )}
                {!hasSubSystems && <span className="w-[18px] flex-shrink-0" />}
                <span className="flex-1 truncate">{isZh ? mt.nameZh : mt.nameEn}</span>
              </div>

              {/* 子系统列表 */}
              {mtExpanded && hasSubSystems && (
                <div className="ml-3 border-l border-gray-100">
                  {mt.subSystems.map((ss) => {
                    const ssKey = `${mt.code}:${ss.code}`;
                    const ssExpanded = expandedSubSystems.has(ssKey);
                    const ssSelected = selectedSubSystem === ss.code && mtSelected;

                    return (
                      <div key={ss.id}>
                        <div
                          className={`flex items-center px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                            ssSelected && !selectedComponentGroup
                              ? "bg-orange-50 text-orange-700 font-medium"
                              : "text-gray-600 hover:bg-gray-50"
                          }`}
                          onClick={() => handleSubSystemClick(mt.code, ss.code)}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSubSystem(ssKey);
                            }}
                            className="flex-shrink-0 mr-1"
                          >
                            {ssExpanded ? (
                              <ChevronDown className="h-3 w-3 text-gray-400" />
                            ) : (
                              <ChevronRight className="h-3 w-3 text-gray-400" />
                            )}
                          </button>
                          <span className="flex-1 truncate text-[13px]">
                            {isZh ? ss.nameZh : ss.nameEn}
                          </span>
                        </div>

                        {/* 部件组列表 */}
                        {ssExpanded && (
                          <div className="ml-3 border-l border-gray-100">
                            {ss.componentGroups.map((cg) => {
                              const cgSelected =
                                selectedComponentGroup === cg.code && ssSelected;

                              return (
                                <button
                                  key={cg.id}
                                  onClick={() =>
                                    handleComponentGroupClick(mt.code, ss.code, cg.code)
                                  }
                                  className={`w-full text-left px-3 py-1.5 text-[13px] transition-colors flex items-center justify-between gap-2 ${
                                    cgSelected
                                      ? "bg-orange-50 text-orange-700 font-medium"
                                      : "text-gray-500 hover:bg-gray-50"
                                  }`}
                                >
                                  <span className="flex-1 truncate">
                                    {isZh ? cg.nameZh : cg.nameEn}
                                  </span>
                                  {cg.partCount > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
                                      {cg.partCount}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
