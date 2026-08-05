"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench } from "lucide-react";

interface PartSpecsTableProps {
  specs: Record<string, string> | null;
  locale: string;
}

// Common spec key labels in Chinese and English
const SPEC_LABELS: Record<string, { zh: string; en: string }> = {
  material: { zh: "材质", en: "Material" },
  weight: { zh: "重量", en: "Weight" },
  dimensions: { zh: "尺寸", en: "Dimensions" },
  warranty: { zh: "保修期", en: "Warranty" },
  pressure: { zh: "压力", en: "Pressure" },
  flowRate: { zh: "流量", en: "Flow Rate" },
  voltage: { zh: "电压", en: "Voltage" },
  power: { zh: "功率", en: "Power" },
  displacement: { zh: "排量", en: "Displacement" },
  bore: { zh: "缸径", en: "Bore" },
  stroke: { zh: "行程", en: "Stroke" },
  diameter: { zh: "直径", en: "Diameter" },
  length: { zh: "长度", en: "Length" },
  width: { zh: "宽度", en: "Width" },
  height: { zh: "高度", en: "Height" },
  thickness: { zh: "厚度", en: "Thickness" },
  temperature: { zh: "工作温度", en: "Temperature" },
  speed: { zh: "转速", en: "Speed" },
  torque: { zh: "扭矩", en: "Torque" },
  type: { zh: "类型", en: "Type" },
  capacity: { zh: "容量", en: "Capacity" },
  viscosity: { zh: "粘度", en: "Viscosity" },
  maxPressure: { zh: "最大压力", en: "Max Pressure" },
  ratedPressure: { zh: "额定压力", en: "Rated Pressure" },
  maxSpeed: { zh: "最大转速", en: "Max Speed" },
  portSize: { zh: "接口尺寸", en: "Port Size" },
  threadSize: { zh: "螺纹尺寸", en: "Thread Size" },
  innerDiameter: { zh: "内径", en: "Inner Diameter" },
  outerDiameter: { zh: "外径", en: "Outer Diameter" },
  bearing: { zh: "轴承", en: "Bearing" },
  sealType: { zh: "密封类型", en: "Seal Type" },
  filterMedia: { zh: "滤材", en: "Filter Media" },
  micron: { zh: "过滤精度", en: "Micron Rating" },
  efficiency: { zh: "效率", en: "Efficiency" },
  cooling: { zh: "冷却方式", en: "Cooling" },
  fuelSystem: { zh: "燃油系统", en: "Fuel System" },
  cylinders: { zh: "气缸数", en: "Cylinders" },
  compressionRatio: { zh: "压缩比", en: "Compression Ratio" },
  heatTreatment: { zh: "热处理", en: "Heat Treatment" },
  journals: { zh: "轴颈", en: "Journals" },
  lift: { zh: "升程", en: "Lift" },
  lobes: { zh: "凸轮数", en: "Lobes" },
  baseCircle: { zh: "基圆", en: "Base Circle" },
  ringCount: { zh: "环数", en: "Ring Count" },
  injectionPressure: { zh: "喷射压力", en: "Injection Pressure" },
  nozzleType: { zh: "喷嘴类型", en: "Nozzle Type" },
  flow: { zh: "流量", en: "Flow" },
  impellerDiameter: { zh: "叶轮直径", en: "Impeller Diameter" },
  compressorWheel: { zh: "压轮", en: "Compressor Wheel" },
  turbineWheel: { zh: "涡轮", en: "Turbine Wheel" },
  maxBoost: { zh: "最大增压", en: "Max Boost" },
  wastegate: { zh: "放气阀", en: "Wastegate" },
  teeth: { zh: "齿数", en: "Teeth" },
  spline: { zh: "花键", en: "Spline" },
  module: { zh: "模数", en: "Module" },
  hardness: { zh: "硬度", en: "Hardness" },
  ratio: { zh: "比率", en: "Ratio" },
  diffLock: { zh: "差速锁", en: "Diff Lock" },
  plyRating: { zh: "层级", en: "Ply Rating" },
  maxLoad: { zh: "最大载荷", en: "Max Load" },
  treadPattern: { zh: "花纹", en: "Tread Pattern" },
  pitch: { zh: "节距", en: "Pitch" },
  links: { zh: "链节数", en: "Links" },
  core: { zh: "芯材", en: "Core" },
  loadCapacity: { zh: "承载能力", en: "Load Capacity" },
  trackWidth: { zh: "轮距", en: "Track Width" },
  steering: { zh: "转向", en: "Steering" },
  clearance: { zh: "间隙", en: "Clearance" },
  cage: { zh: "保持架", en: "Cage" },
  seal: { zh: "密封", en: "Seal" },
  sealIncluded: { zh: "含密封", en: "Seal Included" },
  quantity: { zh: "数量", en: "Quantity" },
  sizes: { zh: "规格", en: "Sizes" },
  storage: { zh: "包装", en: "Storage" },
  flashPoint: { zh: "闪点", en: "Flash Point" },
  pourPoint: { zh: "倾点", en: "Pour Point" },
  volume: { zh: "容量", en: "Volume" },
  viscosityGrade: { zh: "粘度等级", en: "Viscosity Grade" },
  cca: { zh: "冷启动电流", en: "Cold Cranking Amps" },
  lightSource: { zh: "光源", en: "Light Source" },
  beamPattern: { zh: "光束", en: "Beam Pattern" },
  waterproof: { zh: "防水等级", en: "Waterproof" },
  output: { zh: "输出", en: "Output" },
  regulator: { zh: "调节器", en: "Regulator" },
  pulleyType: { zh: "皮带轮", en: "Pulley Type" },
  direction: { zh: "方向", en: "Direction" },
  operatingTemp: { zh: "工作温度", en: "Operating Temp" },
  memory: { zh: "内存", en: "Memory" },
  connector: { zh: "接口", en: "Connector" },
  indicators: { zh: "指示", en: "Indicators" },
  displayType: { zh: "显示屏", en: "Display Type" },
  contacts: { zh: "触点", en: "Contacts" },
  coilResistance: { zh: "线圈电阻", en: "Coil Resistance" },
  output_2: { zh: "输出信号", en: "Output" },
  pressureRange: { zh: "压力范围", en: "Pressure Range" },
  wireGauge: { zh: "线径", en: "Wire Gauge" },
  connectorType: { zh: "接口类型", en: "Connector Type" },
  protection: { zh: "防护", en: "Protection" },
  bypass: { zh: "旁通阀", en: "Bypass" },
  drain: { zh: "排水", en: "Drain" },
  waterRemoval: { zh: "除水率", en: "Water Removal" },
  waterSeparation: { zh: "水分离", en: "Water Separation" },
  spools: { zh: "联数", en: "Spools" },
  maxFlow: { zh: "最大流量", en: "Max Flow" },
  valveType: { zh: "阀门类型", en: "Valve Type" },
  rodDiameter: { zh: "杆径", en: "Rod Diameter" },
  series: { zh: "系列", en: "Series" },
  trunnionLength: { zh: "十字轴长", en: "Trunnion Length" },
  cone: { zh: "锥度", en: "Cone" },
  type_2: { zh: "型式", en: "Type" },
  category: { zh: "类别", en: "Category" },
  pinDiameter: { zh: "销径", en: "Pin Diameter" },
  swivelAngle: { zh: "摆角", en: "Swivel Angle" },
  maxDraw: { zh: "最大牵引", en: "Max Draw" },
  operation: { zh: "操作", en: "Operation" },
  mounting: { zh: "安装", en: "Mounting" },
  color: { zh: "颜色", en: "Color" },
  surface: { zh: "表面处理", en: "Surface" },
  noiseLevel: { zh: "噪音", en: "Noise Level" },
  airConditioning: { zh: "空调", en: "Air Conditioning" },
  seatType: { zh: "座椅", en: "Seat" },
  hinges: { zh: "铰链", en: "Hinges" },
  latchType: { zh: "锁扣", en: "Latch" },
  side: { zh: "侧别", en: "Side" },
  mirrorSize: { zh: "镜面尺寸", en: "Mirror Size" },
  housing: { zh: "外壳", en: "Housing" },
  adjustment: { zh: "调节", en: "Adjustment" },
  tint: { zh: "色调", en: "Tint" },
  standard: { zh: "标准", en: "Standard" },
  topWidth: { zh: "顶宽", en: "Top Width" },
  frictionMaterial: { zh: "摩擦材料", en: "Friction Material" },
  gearRatios: { zh: "齿比", en: "Gear Ratios" },
  splineTeeth: { zh: "花键齿", en: "Spline Teeth" },
  tubeDiameter: { zh: "管径", en: "Tube Diameter" },
  jointType: { zh: "接头", en: "Joint Type" },
  checkValve: { zh: "单向阀", en: "Check Valve" },
  burstPressure: { zh: "爆破压力", en: "Burst Pressure" },
  adjustmentRange: { zh: "调节范围", en: "Adjustment Range" },
  maxTorque: { zh: "最大扭矩", en: "Max Torque" },
};

export default function PartSpecsTable({ specs, locale }: PartSpecsTableProps) {
  const isZh = locale === "zh";

  if (!specs || Object.keys(specs).length === 0) {
    return null;
  }

  const entries = Object.entries(specs);

  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <tbody>
            {entries.map(([key, value], index) => {
              const label = SPEC_LABELS[key]
                ? isZh
                  ? SPEC_LABELS[key].zh
                  : SPEC_LABELS[key].en
                : key;
              return (
                <tr
                  key={key}
                  className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}
                >
                  <td className="px-4 py-2.5 font-medium text-gray-700 w-1/3">
                    {label}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {value}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
