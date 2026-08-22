import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { translate } from "@/lib/i18n-runtime";
import { getLocale } from "next-intl/server";
interface StandardDescriptionProps {
    standardDescriptionEn: string | null;
    descriptionZh: string | null;
    descriptionEn: string | null;
    locale: string;
}
function getLABELS(locale: string): Record<string, {
    title: string;
    defaultDescriptionEn: string;
}> {
  return {
    zh: {
        title: translate("产品描述", locale),
        defaultDescriptionEn: "",
    },
    en: {
        title: "Standard Product Description",
        defaultDescriptionEn: `This is a well-maintained original used farm machine, original parts, no major faults and no collision damage. The engine starts easily and runs smoothly with no abnormal noise or smoke. The hydraulic system operates normally with no leaks. The transmission shifts smoothly across all gears. Tires have adequate tread depth. The cabin interior is clean and all gauges and controls are functional. This machine is ready for work and comes with all standard equipment as shown in the pictures.

All pictures are of the actual machine. We welcome inspections and test runs at our yard. For shipping, we can arrange container loading or RORO (Roll-on/Roll-off) vessel booking. Export documentation including the bill of lading, commercial invoice, and packing list will be provided.

For any questions or to arrange a video call inspection, please contact us.`,
    },
    ru: {
        title: "\u0421\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435",
        defaultDescriptionEn: "",
    },
    es: {
        title: "Descripci\u00F3n Est\u00E1ndar",
        defaultDescriptionEn: "",
    },
    pt: {
        title: "Descri\u00E7\u00E3o Padr\u00E3o",
        defaultDescriptionEn: "",
    },
    ar: {
        title: "\u0627\u0644\u0648\u0635\u0641 \u0627\u0644\u0642\u064A\u0627\u0633\u064A",
        defaultDescriptionEn: "",
    },
    fr: {
        title: "Description Standard",
        defaultDescriptionEn: "",
    },
    hi: {
        title: "\u092E\u093E\u0928\u0915 \u0935\u093F\u0935\u0930\u0923",
        defaultDescriptionEn: "",
    },
};
}
export function StandardDescription({ standardDescriptionEn, descriptionZh, descriptionEn, locale, }: StandardDescriptionProps) {
    const l = getLABELS(locale)[locale] || getLABELS(locale).en;
    if (locale === "zh") {
        // Chinese: display Chinese description
        const zhDesc = descriptionZh;
        if (!zhDesc) {
            return (<Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5"/>
              {l.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 text-sm">{translate("暂无中文描述。", locale)}</p>
          </CardContent>
        </Card>);
        }
        return (<Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5"/>
            {l.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-gray-600 leading-relaxed">
            {zhDesc}
          </p>
        </CardContent>
      </Card>);
    }
    // Non-Chinese: Use standard description if available, fallback to descriptionEn, then default
    const description = standardDescriptionEn || descriptionEn || l.defaultDescriptionEn;
    if (!description) {
        return (<Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5"/>
            {l.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 text-sm">No description available.</p>
        </CardContent>
      </Card>);
    }
    return (<Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5"/>
          {l.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-line text-gray-600 leading-relaxed">
          {description}
        </p>
      </CardContent>
    </Card>);
}
