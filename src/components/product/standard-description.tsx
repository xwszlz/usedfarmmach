import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

interface StandardDescriptionProps {
  standardDescriptionEn: string | null;
  descriptionZh: string | null;
  descriptionEn: string | null;
  locale: string;
}

const LABELS: Record<string, { title: string; defaultDescriptionEn: string }> = {
  zh: {
    title: "产品描述",
    defaultDescriptionEn: "",
  },
  en: {
    title: "Standard Product Description",
    defaultDescriptionEn: `This is a well-maintained original used farm machine, original parts, no major faults and no collision damage. The engine starts easily and runs smoothly with no abnormal noise or smoke. The hydraulic system operates normally with no leaks. The transmission shifts smoothly across all gears. Tires have adequate tread depth. The cabin interior is clean and all gauges and controls are functional. This machine is ready for work and comes with all standard equipment as shown in the pictures.

All pictures are of the actual machine. We welcome inspections and test runs at our yard. For shipping, we can arrange container loading or RORO (Roll-on/Roll-off) vessel booking. Export documentation including the bill of lading, commercial invoice, and packing list will be provided.

For any questions or to arrange a video call inspection, please contact us.`,
  },
  ru: {
    title: "Стандартное описание",
    defaultDescriptionEn: "",
  },
  es: {
    title: "Descripción Estándar",
    defaultDescriptionEn: "",
  },
  pt: {
    title: "Descrição Padrão",
    defaultDescriptionEn: "",
  },
  ar: {
    title: "الوصف القياسي",
    defaultDescriptionEn: "",
  },
  fr: {
    title: "Description Standard",
    defaultDescriptionEn: "",
  },
  hi: {
    title: "मानक विवरण",
    defaultDescriptionEn: "",
  },
};

export function StandardDescription({
  standardDescriptionEn,
  descriptionZh,
  descriptionEn,
  locale,
}: StandardDescriptionProps) {
  const l = LABELS[locale] || LABELS.en;

  if (locale === "zh") {
    // Chinese: display Chinese description
    const zhDesc = descriptionZh;
    if (!zhDesc) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {l.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 text-sm">
              暂无中文描述。
            </p>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {l.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-gray-600 leading-relaxed">
            {zhDesc}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Non-Chinese: Use standard description if available, fallback to descriptionEn, then default
  const description = standardDescriptionEn || descriptionEn || l.defaultDescriptionEn;

  if (!description) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {l.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 text-sm">No description available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {l.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-line text-gray-600 leading-relaxed">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
