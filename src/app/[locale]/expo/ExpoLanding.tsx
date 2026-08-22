"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowRight, Send, Loader2, } from "lucide-react";
import { isCnSite } from "@/config/site";
import { useTr } from "@/lib/i18n-tr";
interface ExpoLandingProps {
    locale: string;
}
function getTEXTS(tr: (s: string) => string): Record<string, {
    badge: string;
    title: string;
    subtitle: string;
    cta: string;
    introTitle: string;
    introBody: string;
    featuresTitle: string;
    features: {
        icon: string;
        title: string;
        desc: string;
    }[];
    benefitsTitle: string;
    benefits: string[];
    formTitle: string;
    formSubtitle: string;
    fields: {
        company: string;
        contact: string;
        phone: string;
        email: string;
        country: string;
        category: string;
        boothType: string;
        message: string;
    };
    boothOptions: string[];
    categoryOptions: string[];
    submit: string;
    submitting: string;
    success: string;
    error: string;
    selectPlaceholder: string;
}> {
  return {
    zh: {
        badge: "\u4E2D\u56FD\u519C\u673A \u00B7 \u8D70\u5411\u4E16\u754C",
        title: tr("永不落幕的农机世界展会"),
        subtitle: "125\u4E2A\u54C1\u724C\u5C55\u4F4D\u3001187\u53F0\u4E2D\u5916\u7CBE\u54C1\u519C\u673A365\u5929\u5728\u7EBF\u5C55\u793A\uFF0C\u4ECE\u4E1C\u65B9\u7EA2\u5230\u5927\u7586\uFF0C\u4ECE\u62D6\u62C9\u673A\u5230\u690D\u4FDD\u65E0\u4EBA\u673A\uFF0C\u8BA9\u4E2D\u56FD\u5236\u9020\u8D70\u5411\u5168\u7403\u7530\u95F4\u3002",
        cta: "\u7ACB\u5373\u7533\u8BF7\u53C2\u5C55",
        introTitle: "\u4E16\u754C\u519C\u673A\u7684\u5168\u7403\u821E\u53F0",
        introBody: "\u4F20\u7EDF\u5C55\u4F1A\u4E00\u5E743\u5929\uFF0C\u9519\u8FC7\u7B49\u4E00\u5E74\u3002\u6211\u4EEC\u5C06\u5C55\u4F1A\u642C\u5230\u7EBF\u4E0A\uFF0C\u8BA9\u5168\u7403\u519C\u673A\u54C1\u724C365\u592924\u5C0F\u65F6\u5411\u5168\u7403\u4E70\u5BB6\u5C55\u793A\u3002\u5168\u7403\u9886\u8896\u9986\u4E3A\u65D7\u8230\uFF0C\u4E2D\u56FD\u4E2D\u575A\u9986\u4E3A\u6838\u5FC3\uFF0C\u65B0\u9510\u4E13\u4E1A\u9986\u4E3A\u8865\u5145\u2014\u2014\u4E09\u9986\u8054\u52A8\uFF0C\u6309\u54C1\u724C\u5168\u7403\u5F71\u54CD\u529B\u5BA2\u89C2\u5206\u7EA7\uFF0C\u4ECE\u5C55\u793A\u5230\u6210\u4EA4\u7684\u5B8C\u6574\u95ED\u73AF\u3002\u7ED3\u5408AI\u4F9B\u9700\u5339\u914D\u3001\u8DE8\u5883\u4EA4\u6613\u62C5\u4FDD\u548C\u56FD\u9645\u7269\u6D41\u670D\u52A1\uFF0C\u8BA9\u5168\u7403\u519C\u673A\u8D70\u5411\u6BCF\u4E00\u5757\u519C\u7530\u3002",
        featuresTitle: "\u6838\u5FC3\u4EAE\u70B9",
        features: [
            {
                icon: "clock",
                title: tr("365天全年在线"),
                desc: "\u4E0D\u53D7\u5C55\u4F1A\u6863\u671F\u9650\u5236\uFF0C\u4EA7\u54C1\u968F\u65F6\u5C55\u793A\u3001\u968F\u65F6\u66F4\u65B0\u3001\u968F\u65F6\u63A5\u5355",
            },
            {
                icon: "globe",
                title: tr("全球买家触达"),
                desc: "\u4E2D\u82F1\u4FC4\u7B498\u8BED\u79CD\u8986\u76D6\uFF0C\u4E70\u5BB6\u6765\u81EA\u4E2D\u4E9A\u3001\u4E1C\u6B27\u3001\u4E1C\u5357\u4E9A\u3001\u975E\u6D32\u3001\u5357\u7F8E",
            },
            {
                icon: "bot",
                title: tr("AI供需匹配"),
                desc: "\u667A\u80FD\u5F15\u64CE\u81EA\u52A8\u5339\u914D\u4E70\u5BB6\u9700\u6C42\u4E0E\u5356\u5BB6\u4EA7\u54C1\uFF0C\u7CBE\u51C6\u63A8\u9001\u9AD8\u610F\u5411\u8BE2\u76D8",
            },
            {
                icon: "shield",
                title: tr("交易担保"),
                desc: "\u8D44\u91D1\u6258\u7BA1\u3001\u9A8C\u673A\u62A5\u544A\u3001\u533A\u5757\u94FE\u6EAF\u6E90\uFF0C\u8DE8\u5883\u4EA4\u6613\u5B89\u5168\u65E0\u5FE7",
            },
            {
                icon: "trending",
                title: tr("数据驱动"),
                desc: "\u5168\u7403\u4E8C\u624B\u519C\u673A\u4EF7\u683C\u6307\u6570\u3001\u5E02\u573A\u60C5\u62A5\u901F\u9012\uFF0C\u7528\u6570\u636E\u8D4B\u80FD\u51B3\u7B56",
            },
            {
                icon: "ship",
                title: tr("跨境物流"),
                desc: "\u6D77\u5916\u4ED3+\u95E8\u5230\u95E8\u7269\u6D41\u65B9\u6848\uFF0CFOB\u4E2D\u56FD\u6E2F\u53E3\u5230\u4E70\u5BB6\u624B\u4E2D\u5168\u7A0B\u53EF\u89C6",
            },
        ],
        benefitsTitle: "\u53C2\u5C55\u6743\u76CA",
        benefits: [
            "365\u5929\u7EBF\u4E0A\u865A\u62DF\u5C55\u4F4D\uFF0C\u4EA7\u54C1\u56FE\u6587+\u89C6\u9891\u5168\u5929\u5019\u5C55\u793A",
            "AI\u4F9B\u9700\u5339\u914D\u5F15\u64CE\uFF0C\u9AD8\u610F\u5411\u4E70\u5BB6\u8BE2\u76D8\u4F18\u5148\u63A8\u9001",
            "\u5168\u74038\u8BED\u79CD\u4EA7\u54C1\u8BE6\u60C5\u9875\uFF0C\u6D88\u9664\u8BED\u8A00\u58C1\u5792",
            "\u8DE8\u5883\u4EA4\u6613\u62C5\u4FDD\u670D\u52A1\uFF0C\u8D44\u91D1\u5B89\u5168\u6709\u4FDD\u969C",
            "\u6708\u5EA6\u5E02\u573A\u60C5\u62A5\u62A5\u544A\uFF0C\u638C\u63E1\u884C\u4E1A\u4EF7\u683C\u8D8B\u52BF",
            "\u7EBF\u4E0B\u5730\u5934\u5C55\u4F18\u5148\u53C2\u5C55\u6743\uFF0C\u7EBF\u4E0A\u7EBF\u4E0B\u4E00\u4F53\u5316",
            "CAMDA\u4E8C\u624B\u519C\u673A\u5206\u4F1A\u4F1A\u5458\u63A8\u8350\u901A\u9053",
            "\u6D77\u5916\u4ED3+\u7269\u6D41\u65B9\u6848\u4E13\u5C5E\u6298\u6263",
        ],
        formTitle: "\u62DB\u5546\u610F\u5411\u8868",
        formSubtitle: "\u586B\u5199\u4EE5\u4E0B\u4FE1\u606F\uFF0C\u6211\u4EEC\u5C06\u572824\u5C0F\u65F6\u5185\u4E0E\u60A8\u8054\u7CFB",
        fields: {
            company: "\u516C\u53F8\u540D\u79F0",
            contact: "\u8054\u7CFB\u4EBA",
            phone: "\u624B\u673A\u53F7",
            email: "\u90AE\u7BB1",
            country: "\u6240\u5728\u56FD\u5BB6/\u5730\u533A",
            category: "\u4E3B\u8425\u54C1\u7C7B",
            boothType: "\u610F\u5411\u5C55\u4F4D\u7C7B\u578B",
            message: tr("留言（选填）"),
        },
        boothOptions: [
            "\u57FA\u7840\u5C55\u4F4D \u00A5380/\u5E74\uFF085\u6B3E\u4EA7\u54C1\u5C55\u793A\uFF09",
            "\u4F18\u9009\u5C55\u4F4D \u00A5980/\u5E74\uFF0820\u6B3E\u4EA7\u54C1+\u89C6\u9891\u5C55\u793A\uFF09",
            "\u65D7\u8230\u5C55\u4F4D \u00A52,880/\u5E74\uFF08\u4E0D\u9650\u91CF+VR\u5C55\u5385+\u4F18\u5148\u63A8\u8350\uFF09",
            "\u6682\u4E0D\u786E\u5B9A\uFF0C\u8BF7\u987E\u95EE\u8054\u7CFB\u6211",
        ],
        categoryOptions: [
            "\u62D6\u62C9\u673A",
            "\u9752\u50A8\u673A/\u7267\u8349\u6536\u5272\u673A",
            "\u6253\u6346\u673A",
            "\u5272\u53F0/\u6361\u62FE\u5272\u53F0",
            "\u88F9\u5305\u673A",
            "\u6402\u8349\u673A/\u644A\u6652\u673A",
            "\u519C\u673A\u914D\u4EF6",
            "\u5176\u4ED6\u519C\u673A\u8BBE\u5907",
        ],
        submit: "\u63D0\u4EA4\u7533\u8BF7",
        submitting: "\u63D0\u4EA4\u4E2D...",
        success: "\u63D0\u4EA4\u6210\u529F\uFF01\u6211\u4EEC\u5C06\u572824\u5C0F\u65F6\u5185\u4E0E\u60A8\u8054\u7CFB\u3002",
        error: "\u63D0\u4EA4\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u6216\u76F4\u63A5\u8054\u7CFB WhatsApp: +86 15511395016",
        selectPlaceholder: "\u8BF7\u9009\u62E9",
    },
    en: {
        badge: "Chinese Machinery \u00B7 Global Stage",
        title: "The Always-On Global Farm Machinery Expo",
        subtitle: "125 farm machinery brand booths on display 365 days a year. From Dongfanghong to DJI, from tractors to drones \u2014 bringing Chinese manufacturing to fields worldwide.",
        cta: "Apply to Exhibit",
        introTitle: "The World Stage for Chinese Farm Machinery",
        introBody: "Traditional expos last 3 days a year \u2014 miss it and wait another year. We bring the expo online, showcasing Chinese farm machinery brands to global buyers 24/7/365. The China Pavilion takes center stage, the Global Pavilion provides benchmarks, and the Category Comparison Hall helps buyers decide \u2014 three halls working together from display to deal. Combined with AI matching, cross-border escrow, and international logistics, we bring Chinese machinery to every field along the Belt & Road.",
        featuresTitle: "Key Highlights",
        features: [
            {
                icon: "clock",
                title: "365-Day Online",
                desc: "No expo schedule limits \u2014 display, update, and sell anytime",
            },
            {
                icon: "globe",
                title: "Global Buyer Reach",
                desc: "8 languages covering Central Asia, Eastern Europe, SE Asia, Africa, South America",
            },
            {
                icon: "bot",
                title: "AI Matching",
                desc: "Smart engine auto-matches buyer demand with seller inventory, pushing high-intent leads",
            },
            {
                icon: "shield",
                title: "Escrow Protection",
                desc: "Fund custody, inspection reports, blockchain traceability \u2014 safe cross-border deals",
            },
            {
                icon: "trending",
                title: "Data-Driven",
                desc: "Global used machinery price index, market intel reports \u2014 data empowers decisions",
            },
            {
                icon: "ship",
                title: "Cross-Border Logistics",
                desc: "Overseas warehouses + door-to-door logistics, full visibility from FOB China to buyer",
            },
        ],
        benefitsTitle: "Exhibitor Benefits",
        benefits: [
            "365-day virtual booth with photo + video product showcase",
            "AI matching engine prioritizes high-intent buyer inquiries",
            "8-language product detail pages, eliminating language barriers",
            "Cross-border escrow service for secure fund protection",
            "Monthly market intelligence reports with price trends",
            "Priority access to offline field expos \u2014 online + offline integration",
            "CAMDA Used Machinery Chapter member referral channel",
            "Exclusive discounts on overseas warehouse + logistics",
        ],
        formTitle: "Exhibitor Inquiry Form",
        formSubtitle: "Fill out the form below and we'll contact you within 24 hours",
        fields: {
            company: "Company Name",
            contact: "Contact Person",
            phone: "Phone Number",
            email: "Email",
            country: "Country / Region",
            category: "Main Product Category",
            boothType: "Booth Type Interest",
            message: "Message (Optional)",
        },
        boothOptions: [
            "Basic \u00A5380/yr (5 products)",
            "Premium \u00A5980/yr (20 products + video)",
            "Flagship \u00A52,880/yr (unlimited + VR + priority)",
            "Not sure, please contact me",
        ],
        categoryOptions: [
            "Tractors",
            "Forage Harvesters",
            "Balers",
            "Headers / Pickup Heads",
            "Bale Wrappers",
            "Rakes / Tedders",
            "Parts",
            "Other Machinery",
        ],
        submit: "Submit Application",
        submitting: "Submitting...",
        success: "Submitted successfully! We'll contact you within 24 hours.",
        error: "Submission failed. Please try again or contact Email: 932133255@qq.com",
        selectPlaceholder: "Please select",
    },
    ru: {
        badge: "\u041A\u0438\u0442\u0430\u0439\u0441\u043A\u0430\u044F \u0442\u0435\u0445\u043D\u0438\u043A\u0430 \u00B7 \u041C\u0438\u0440\u043E\u0432\u0430\u044F \u0441\u0446\u0435\u043D\u0430",
        title: "\u0412\u0441\u0435\u043C\u0438\u0440\u043D\u0430\u044F \u0432\u044B\u0441\u0442\u0430\u0432\u043A\u0430 \u0441\u0435\u043B\u044C\u0445\u043E\u0437\u0442\u0435\u0445\u043D\u0438\u043A\u0438 \u0431\u0435\u0437 \u0432\u044B\u0445\u043E\u0434\u043D\u044B\u0445",
        subtitle: "125 \u043A\u0438\u0442\u0430\u0439\u0441\u043A\u0438\u0445 \u0431\u0440\u0435\u043D\u0434\u0430 \u0441\u0435\u043B\u044C\u0445\u043E\u0437\u0442\u0435\u0445\u043D\u0438\u043A\u0438 \u043D\u0430 \u0432\u0438\u0442\u0440\u0438\u043D\u0435 365 \u0434\u043D\u0435\u0439 \u0432 \u0433\u043E\u0434\u0443. \u041E\u0442 Dongfanghong \u0434\u043E DJI, \u043E\u0442 \u0442\u0440\u0430\u043A\u0442\u043E\u0440\u043E\u0432 \u0434\u043E \u0434\u0440\u043E\u043D\u043E\u0432 \u2014 \u043A\u0438\u0442\u0430\u0439\u0441\u043A\u043E\u0435 \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0441\u0442\u0432\u043E \u0434\u043B\u044F \u043F\u043E\u043B\u0435\u0439 \u0432\u0441\u0435\u0433\u043E \u043C\u0438\u0440\u0430.",
        cta: "\u041F\u043E\u0434\u0430\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443",
        introTitle: "\u041C\u0438\u0440\u043E\u0432\u0430\u044F \u0441\u0446\u0435\u043D\u0430 \u0434\u043B\u044F \u043A\u0438\u0442\u0430\u0439\u0441\u043A\u043E\u0439 \u0441\u0435\u043B\u044C\u0445\u043E\u0437\u0442\u0435\u0445\u043D\u0438\u043A\u0438",
        introBody: "\u0422\u0440\u0430\u0434\u0438\u0446\u0438\u043E\u043D\u043D\u044B\u0435 \u0432\u044B\u0441\u0442\u0430\u0432\u043A\u0438 \u0434\u043B\u044F\u0442\u0441\u044F 3 \u0434\u043D\u044F \u0432 \u0433\u043E\u0434\u0443 \u2014 \u043F\u0440\u043E\u043F\u0443\u0441\u0442\u0438\u043B\u0438, \u0436\u0434\u0438\u0442\u0435 \u0435\u0449\u0451 \u0433\u043E\u0434. \u041C\u044B \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u043B\u0438 \u0432\u044B\u0441\u0442\u0430\u0432\u043A\u0443 \u043E\u043D\u043B\u0430\u0439\u043D: \u043A\u0438\u0442\u0430\u0439\u0441\u043A\u0438\u0435 \u0431\u0440\u0435\u043D\u0434\u044B \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u043F\u043E\u043A\u0443\u043F\u0430\u0442\u0435\u043B\u044F\u043C 24/7/365. \u041A\u0438\u0442\u0430\u0439\u0441\u043A\u0438\u0439 \u0437\u0430\u043B \u2014 \u0433\u043B\u0430\u0432\u043D\u0430\u044F \u0441\u0446\u0435\u043D\u0430, \u041C\u0435\u0436\u0434\u0443\u043D\u0430\u0440\u043E\u0434\u043D\u044B\u0439 \u0437\u0430\u043B \u2014 \u043E\u0440\u0438\u0435\u043D\u0442\u0438\u0440, \u0417\u0430\u043B \u0441\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u044F \u2014 \u043F\u043E\u043C\u043E\u0449\u043D\u0438\u043A \u0432 \u0432\u044B\u0431\u043E\u0440\u0435. \u0422\u0440\u0438 \u0437\u0430\u043B\u0430 \u0432\u043C\u0435\u0441\u0442\u0435: \u043E\u0442 \u043F\u043E\u043A\u0430\u0437\u0430 \u0434\u043E \u0441\u0434\u0435\u043B\u043A\u0438. AI-\u043F\u043E\u0434\u0431\u043E\u0440, \u044D\u0441\u043A\u0440\u043E\u0443-\u0441\u0435\u0440\u0432\u0438\u0441 \u0438 \u043C\u0435\u0436\u0434\u0443\u043D\u0430\u0440\u043E\u0434\u043D\u0430\u044F \u043B\u043E\u0433\u0438\u0441\u0442\u0438\u043A\u0430 \u0434\u043E\u0432\u043E\u0437\u044F\u0442 \u043A\u0438\u0442\u0430\u0439\u0441\u043A\u0443\u044E \u0442\u0435\u0445\u043D\u0438\u043A\u0443 \u0434\u043E \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u043F\u043E\u043B\u044F \u0432\u0434\u043E\u043B\u044C \u0428\u0451\u043B\u043A\u043E\u0432\u043E\u0433\u043E \u043F\u0443\u0442\u0438.",
        featuresTitle: "\u041A\u043B\u044E\u0447\u0435\u0432\u044B\u0435 \u043F\u0440\u0435\u0438\u043C\u0443\u0449\u0435\u0441\u0442\u0432\u0430",
        features: [
            {
                icon: "clock",
                title: "365 \u0434\u043D\u0435\u0439 \u043E\u043D\u043B\u0430\u0439\u043D",
                desc: "\u0411\u0435\u0437 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u0439 \u043F\u043E \u0440\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u044E \u2014 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0439\u0442\u0435 \u0438 \u043F\u0440\u043E\u0434\u0430\u0432\u0430\u0439\u0442\u0435 \u0432 \u043B\u044E\u0431\u043E\u0435 \u0432\u0440\u0435\u043C\u044F",
            },
            {
                icon: "globe",
                title: "\u0413\u043B\u043E\u0431\u0430\u043B\u044C\u043D\u044B\u0439 \u043E\u0445\u0432\u0430\u0442",
                desc: "8 \u044F\u0437\u044B\u043A\u043E\u0432: \u0426\u0435\u043D\u0442\u0440\u0430\u043B\u044C\u043D\u0430\u044F \u0410\u0437\u0438\u044F, \u0412\u043E\u0441\u0442\u043E\u0447\u043D\u0430\u044F \u0415\u0432\u0440\u043E\u043F\u0430, \u042E\u0433\u043E-\u0412\u043E\u0441\u0442\u043E\u0447\u043D\u0430\u044F \u0410\u0437\u0438\u044F, \u0410\u0444\u0440\u0438\u043A\u0430, \u042E\u0436\u043D\u0430\u044F \u0410\u043C\u0435\u0440\u0438\u043A\u0430",
            },
            {
                icon: "bot",
                title: "AI-\u043F\u043E\u0434\u0431\u043E\u0440",
                desc: "\u0423\u043C\u043D\u044B\u0439 \u0434\u0432\u0438\u0436\u043E\u043A \u0441\u043E\u043F\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442 \u0441\u043F\u0440\u043E\u0441 \u0438 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435, \u043D\u0430\u043F\u0440\u0430\u0432\u043B\u044F\u044F \u0446\u0435\u043B\u0435\u0432\u044B\u0435 \u043B\u0438\u0434\u044B",
            },
            {
                icon: "shield",
                title: "\u042D\u0441\u043A\u0440\u043E\u0443-\u0437\u0430\u0449\u0438\u0442\u0430",
                desc: "\u0425\u0440\u0430\u043D\u0435\u043D\u0438\u0435 \u0441\u0440\u0435\u0434\u0441\u0442\u0432, \u043E\u0442\u0447\u0451\u0442\u044B \u043E\u0431 \u043E\u0441\u043C\u043E\u0442\u0440\u0435, \u0431\u043B\u043E\u043A\u0447\u0435\u0439\u043D-\u0442\u0440\u0430\u0441\u0441\u0438\u0440\u043E\u0432\u043A\u0430 \u2014 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u044B\u0435 \u0441\u0434\u0435\u043B\u043A\u0438",
            },
            {
                icon: "trending",
                title: "\u041D\u0430 \u043E\u0441\u043D\u043E\u0432\u0435 \u0434\u0430\u043D\u043D\u044B\u0445",
                desc: "\u0413\u043B\u043E\u0431\u0430\u043B\u044C\u043D\u044B\u0439 \u0438\u043D\u0434\u0435\u043A\u0441 \u0446\u0435\u043D, \u0440\u044B\u043D\u043E\u0447\u043D\u0430\u044F \u0430\u043D\u0430\u043B\u0438\u0442\u0438\u043A\u0430 \u2014 \u0434\u0430\u043D\u043D\u044B\u0435 \u0434\u043B\u044F \u043F\u0440\u0438\u043D\u044F\u0442\u0438\u044F \u0440\u0435\u0448\u0435\u043D\u0438\u0439",
            },
            {
                icon: "ship",
                title: "\u0422\u0440\u0430\u043D\u0441\u0433\u0440\u0430\u043D\u0438\u0447\u043D\u0430\u044F \u043B\u043E\u0433\u0438\u0441\u0442\u0438\u043A\u0430",
                desc: "\u0417\u0430\u0440\u0443\u0431\u0435\u0436\u043D\u044B\u0435 \u0441\u043A\u043B\u0430\u0434\u044B + \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0430 \u043E\u0442 \u0434\u0432\u0435\u0440\u0438 \u0434\u043E \u0434\u0432\u0435\u0440\u0438 \u0441 \u043F\u043E\u043B\u043D\u044B\u043C \u043E\u0442\u0441\u043B\u0435\u0436\u0438\u0432\u0430\u043D\u0438\u0435\u043C",
            },
        ],
        benefitsTitle: "\u041F\u0440\u0435\u0438\u043C\u0443\u0449\u0435\u0441\u0442\u0432\u0430 \u0434\u043B\u044F \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432",
        benefits: [
            "365-\u0434\u043D\u0435\u0432\u043D\u044B\u0439 \u0432\u0438\u0440\u0442\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u0441\u0442\u0435\u043D\u0434 \u0441 \u0444\u043E\u0442\u043E \u0438 \u0432\u0438\u0434\u0435\u043E",
            "AI-\u043F\u043E\u0434\u0431\u043E\u0440 \u043F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442\u043D\u044B\u0445 \u0437\u0430\u043F\u0440\u043E\u0441\u043E\u0432 \u043E\u0442 \u043F\u043E\u043A\u0443\u043F\u0430\u0442\u0435\u043B\u0435\u0439",
            "\u0421\u0442\u0440\u0430\u043D\u0438\u0446\u044B \u0442\u043E\u0432\u0430\u0440\u043E\u0432 \u043D\u0430 8 \u044F\u0437\u044B\u043A\u0430\u0445",
            "\u042D\u0441\u043A\u0440\u043E\u0443-\u0441\u0435\u0440\u0432\u0438\u0441 \u0434\u043B\u044F \u0437\u0430\u0449\u0438\u0442\u044B \u0441\u0440\u0435\u0434\u0441\u0442\u0432",
            "\u0415\u0436\u0435\u043C\u0435\u0441\u044F\u0447\u043D\u044B\u0435 \u043E\u0442\u0447\u0451\u0442\u044B \u043F\u043E \u0440\u044B\u043D\u043E\u0447\u043D\u043E\u0439 \u0430\u043D\u0430\u043B\u0438\u0442\u0438\u043A\u0435",
            "\u041F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442 \u043D\u0430 \u043E\u0444\u043B\u0430\u0439\u043D-\u0432\u044B\u0441\u0442\u0430\u0432\u043A\u0430\u0445",
            "\u041A\u0430\u043D\u0430\u043B \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0439 \u0432 CAMDA",
            "\u0421\u043A\u0438\u0434\u043A\u0438 \u043D\u0430 \u0441\u043A\u043B\u0430\u0434\u044B \u0438 \u043B\u043E\u0433\u0438\u0441\u0442\u0438\u043A\u0443",
        ],
        formTitle: "\u0417\u0430\u044F\u0432\u043A\u0430 \u043D\u0430 \u0443\u0447\u0430\u0441\u0442\u0438\u0435",
        formSubtitle: "\u0417\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0444\u043E\u0440\u043C\u0443, \u0438 \u043C\u044B \u0441\u0432\u044F\u0436\u0435\u043C\u0441\u044F \u0441 \u0432\u0430\u043C\u0438 \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 24 \u0447\u0430\u0441\u043E\u0432",
        fields: {
            company: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0438",
            contact: "\u041A\u043E\u043D\u0442\u0430\u043A\u0442\u043D\u043E\u0435 \u043B\u0438\u0446\u043E",
            phone: "\u0422\u0435\u043B\u0435\u0444\u043E\u043D",
            email: "Email",
            country: "\u0421\u0442\u0440\u0430\u043D\u0430 / \u0420\u0435\u0433\u0438\u043E\u043D",
            category: "\u041E\u0441\u043D\u043E\u0432\u043D\u0430\u044F \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F",
            boothType: "\u0422\u0438\u043F \u0441\u0442\u0435\u043D\u0434\u0430",
            message: "\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 (\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)",
        },
        boothOptions: [
            "\u0411\u0430\u0437\u043E\u0432\u044B\u0439 \u00A5380/\u0433\u043E\u0434 (5 \u0442\u043E\u0432\u0430\u0440\u043E\u0432)",
            "\u041F\u0440\u0435\u043C\u0438\u0443\u043C \u00A5980/\u0433\u043E\u0434 (20 \u0442\u043E\u0432\u0430\u0440\u043E\u0432 + \u0432\u0438\u0434\u0435\u043E)",
            "\u0424\u043B\u0430\u0433\u043C\u0430\u043D \u00A52,880/\u0433\u043E\u0434 (\u0431\u0435\u0437 \u043B\u0438\u043C\u0438\u0442\u0430 + VR + \u043F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442)",
            "\u041D\u0435 \u0443\u0432\u0435\u0440\u0435\u043D, \u0441\u0432\u044F\u0436\u0438\u0442\u0435\u0441\u044C \u0441\u043E \u043C\u043D\u043E\u0439",
        ],
        categoryOptions: [
            "\u0422\u0440\u0430\u043A\u0442\u043E\u0440\u044B",
            "\u041A\u043E\u0440\u043C\u043E\u0443\u0431\u043E\u0440\u043E\u0447\u043D\u044B\u0435 \u043A\u043E\u043C\u0431\u0430\u0439\u043D\u044B",
            "\u041F\u0440\u0435\u0441\u0441-\u043F\u043E\u0434\u0431\u043E\u0440\u0449\u0438\u043A\u0438",
            "\u0416\u0430\u0442\u043A\u0438",
            "\u041E\u0431\u043C\u043E\u0442\u0447\u0438\u043A\u0438",
            "\u0413\u0440\u0430\u0431\u043B\u0438 / \u0412\u043E\u0440\u043E\u0448\u0438\u0442\u0435\u043B\u0438",
            "\u0417\u0430\u043F\u0447\u0430\u0441\u0442\u0438",
            "\u0414\u0440\u0443\u0433\u0430\u044F \u0442\u0435\u0445\u043D\u0438\u043A\u0430",
        ],
        submit: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443",
        submitting: "\u041E\u0442\u043F\u0440\u0430\u0432\u043A\u0430...",
        success: "\u0417\u0430\u044F\u0432\u043A\u0430 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0430! \u041C\u044B \u0441\u0432\u044F\u0436\u0435\u043C\u0441\u044F \u0441 \u0432\u0430\u043C\u0438 \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 24 \u0447\u0430\u0441\u043E\u0432.",
        error: "\u041E\u0448\u0438\u0431\u043A\u0430 \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u0438. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u0438\u043B\u0438 \u043D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 WhatsApp: +86 15511395016",
        selectPlaceholder: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435",
    },
    es: {
        badge: "Maquinaria China \u00B7 Escenario Global",
        title: "Expo Mundial de Maquinaria Agr\u00EDcola Siempre Activada",
        subtitle: "125 marcas chinas de maquinaria agr\u00EDcola con modelos insignia en exhibici\u00F3n 365 d\u00EDas al a\u00F1o. De Dongfanghong a DJI, de tractores a drones: la fabricaci\u00F3n china llega a los campos del mundo.",
        cta: "Solicitar Participaci\u00F3n",
        introTitle: "El Escenario Mundial para la Maquinaria Agr\u00EDcola China",
        introBody: "Las expos tradicionales duran 3 d\u00EDas al a\u00F1o. Nosotros trasladamos la expo online, exhibiendo marcas chinas a compradores globales 24/7/365. El Pabell\u00F3n de China es el protagonista, el Pabell\u00F3n Global es la referencia, y la Sala de Comparaci\u00F3n ayuda a decidir. Tres pabellones juntos: de la exhibici\u00F3n al cierre. Con matching por IA, custodia transfronteriza y log\u00EDstica internacional, llevamos la maquinaria china a cada campo.",
        featuresTitle: "Caracter\u00EDsticas Clave",
        features: [
            { icon: "clock", title: "365 D\u00EDas Online", desc: "Sin l\u00EDmites de horario: exhibe, actualiza y vende en cualquier momento" },
            { icon: "globe", title: "Alcance Global", desc: "8 idiomas: Asia Central, Europa del Este, Sudeste Asi\u00E1tico, \u00C1frica, Sudam\u00E9rica" },
            { icon: "bot", title: "Matching IA", desc: "Motor inteligente que conecta demanda con inventario, generando leads de alta intenci\u00F3n" },
            { icon: "shield", title: "Custodia Comercial", desc: "Custodia de fondos, informes de inspecci\u00F3n, trazabilidad blockchain" },
            { icon: "trending", title: "Basado en Datos", desc: "\u00CDndice global de precios, informes de inteligencia de mercado" },
            { icon: "ship", title: "Log\u00EDstica Transfronteriza", desc: "Almacenes en el extranjero + log\u00EDstica puerta a puerta con visibilidad total" },
        ],
        benefitsTitle: "Beneficios del Expositor",
        benefits: [
            "Stand virtual 365 d\u00EDas con exhibici\u00F3n de fotos y video",
            "Motor de matching IA prioriza consultas de alta intenci\u00F3n",
            "P\u00E1ginas de producto en 8 idiomas",
            "Servicio de custodia transfronteriza para fondos seguros",
            "Informes mensuales de inteligencia de mercado",
            "Acceso prioritario a expos presenciales",
            "Canal de recomendaci\u00F3n CAMDA",
            "Descuentos exclusivos en almacenes y log\u00EDstica",
        ],
        formTitle: "Formulario de Consulta",
        formSubtitle: "Complete el formulario y le contactaremos en 24 horas",
        fields: {
            company: "Nombre de la Empresa",
            contact: "Persona de Contacto",
            phone: "Tel\u00E9fono",
            email: "Email",
            country: "Pa\u00EDs / Regi\u00F3n",
            category: "Categor\u00EDa Principal",
            boothType: "Tipo de Stand",
            message: "Mensaje (Opcional)",
        },
        boothOptions: [
            "B\u00E1sico \u00A5380/a\u00F1o (5 productos)",
            "Premium \u00A5980/a\u00F1o (20 productos + video)",
            "Insignia \u00A52,880/a\u00F1o (ilimitado + VR + prioridad)",
            "No estoy seguro, cont\u00E1ctenme",
        ],
        categoryOptions: [
            "Tractores",
            "Cosechadoras de Forraje",
            "Empacadoras",
            "Cabezales",
            "Envolvedoras",
            "Rastrillos / Volteadores",
            "Repuestos",
            "Otra Maquinaria",
        ],
        submit: "Enviar Solicitud",
        submitting: "Enviando...",
        success: "\u00A1Enviado con \u00E9xito! Le contactaremos en 24 horas.",
        error: "Error. Intente de nuevo o contacte Email: 932133255@qq.com",
        selectPlaceholder: "Seleccione",
    },
    pt: {
        badge: "M\u00E1quinas Chinesas \u00B7 Palco Global",
        title: "Expo Mundial de Maquin\u00E1rio Agr\u00EDcola Sempre Ativa",
        subtitle: "125 marcas chinesas de maquin\u00E1rio agr\u00EDcola com modelos flagship em exibi\u00E7\u00E3o 365 dias por ano. De Dongfanghong a DJI, de tratores a drones: a fabrica\u00E7\u00E3o chinesa chega aos campos do mundo.",
        cta: "Solicitar Participa\u00E7\u00E3o",
        introTitle: "O Palco Mundial para o Maquin\u00E1rio Agr\u00EDcola Chin\u00EAs",
        introBody: "Feiras tradicionais duram 3 dias por ano. N\u00F3s trazemos a feira online, exibindo marcas chinesas a compradores globais 24/7/365. O Pavilh\u00E3o da China \u00E9 o protagonista, o Pavilh\u00E3o Global \u00E9 a refer\u00EAncia, e a Sala de Compara\u00E7\u00E3o ajuda na decis\u00E3o. Tr\u00EAs pavilh\u00F5es juntos: da exibi\u00E7\u00E3o ao fechamento. Com matching por IA, cust\u00F3dia transfronteiri\u00E7a e log\u00EDstica internacional, levamos o maquin\u00E1rio chin\u00EAs a cada campo.",
        featuresTitle: "Destaques Principais",
        features: [
            { icon: "clock", title: "365 Dias Online", desc: "Sem limites de agenda: exiba, atualize e venda a qualquer momento" },
            { icon: "globe", title: "Alcance Global", desc: "8 idiomas: \u00C1sia Central, Europa Oriental, Sudeste Asi\u00E1tico, \u00C1frica, Am\u00E9rica do Sul" },
            { icon: "bot", title: "Matching IA", desc: "Motor inteligente que conecta demanda com estoque, gerando leads de alta inten\u00E7\u00E3o" },
            { icon: "shield", title: "Cust\u00F3dia Comercial", desc: "Cust\u00F3dia de fundos, relat\u00F3rios de inspe\u00E7\u00E3o, rastreabilidade blockchain" },
            { icon: "trending", title: "Orientado a Dados", desc: "\u00CDndice global de pre\u00E7os, relat\u00F3rios de intelig\u00EAncia de mercado" },
            { icon: "ship", title: "Log\u00EDstica Transfronteiri\u00E7a", desc: "Armaz\u00E9ns no exterior + log\u00EDstica porta a porta com visibilidade total" },
        ],
        benefitsTitle: "Benef\u00EDcios do Expositor",
        benefits: [
            "Estande virtual 365 dias com exibi\u00E7\u00E3o de fotos e v\u00EDdeo",
            "Motor de matching IA prioriza consultas de alta inten\u00E7\u00E3o",
            "P\u00E1ginas de produto em 8 idiomas",
            "Servi\u00E7o de cust\u00F3dia transfronteiri\u00E7a para fundos seguros",
            "Relat\u00F3rios mensais de intelig\u00EAncia de mercado",
            "Acesso priorit\u00E1rio a feiras presenciais",
            "Canal de indica\u00E7\u00E3o CAMDA",
            "Descontos exclusivos em armaz\u00E9ns e log\u00EDstica",
        ],
        formTitle: "Formul\u00E1rio de Consulta",
        formSubtitle: "Preencha o formul\u00E1rio e entraremos em contato em 24 horas",
        fields: {
            company: "Nome da Empresa",
            contact: "Pessoa de Contato",
            phone: "Telefone",
            email: "Email",
            country: "Pa\u00EDs / Regi\u00E3o",
            category: "Categoria Principal",
            boothType: "Tipo de Estande",
            message: "Mensagem (Opcional)",
        },
        boothOptions: [
            "B\u00E1sico \u00A5380/ano (5 produtos)",
            "Premium \u00A5980/ano (20 produtos + v\u00EDdeo)",
            "Flagship \u00A52,880/ano (ilimitado + VR + prioridade)",
            "N\u00E3o tenho certeza, entre em contato",
        ],
        categoryOptions: [
            "Tratores",
            "Colhedoras de Forragem",
            "Enfardadoras",
            "Cabe\u00E7otes",
            "Envolvedoras",
            "Ancinhos / Volteadores",
            "Pe\u00E7as",
            "Outros Equipamentos",
        ],
        submit: "Enviar Solicita\u00E7\u00E3o",
        submitting: "Enviando...",
        success: "Enviado com sucesso! Entraremos em contato em 24 horas.",
        error: "Erro. Tente novamente ou contate WhatsApp: +86 15511395016",
        selectPlaceholder: "Selecione",
    },
    ar: {
        badge: "\u0627\u0644\u0622\u0644\u0627\u062A \u0627\u0644\u0635\u064A\u0646\u064A\u0629 \u00B7 \u0645\u0646\u0635\u0629 \u0639\u0627\u0644\u0645\u064A\u0629",
        title: "\u0627\u0644\u0645\u0639\u0631\u0636 \u0627\u0644\u0639\u0627\u0644\u0645\u064A \u0627\u0644\u062F\u0627\u0626\u0645 \u0644\u0644\u0622\u0644\u0627\u062A \u0627\u0644\u0632\u0631\u0627\u0639\u064A\u0629",
        subtitle: "125 \u0639\u0644\u0627\u0645\u0629 \u062A\u062C\u0627\u0631\u064A\u0629 \u0635\u064A\u0646\u064A\u0629 \u0644\u0644\u0622\u0644\u0627\u062A \u0627\u0644\u0632\u0631\u0627\u0639\u064A\u0629 \u0645\u0639 \u0646\u0645\u0627\u0630\u062C \u0631\u0626\u064A\u0633\u064A\u0629 \u0645\u0639\u0631\u0648\u0636\u0629 365 \u064A\u0648\u0645\u0627\u064B \u0641\u064A \u0627\u0644\u0633\u0646\u0629. \u0645\u0646 \u062F\u0648\u0646\u063A\u0641\u0627\u0646\u063A \u0647\u0648\u0646\u063A \u0625\u0644\u0649 DJI\u060C \u0645\u0646 \u0627\u0644\u062C\u0631\u0627\u0631\u0627\u062A \u0625\u0644\u0649 \u0627\u0644\u0637\u0627\u0626\u0631\u0627\u062A \u0627\u0644\u0645\u0633\u064A\u0631\u0629: \u0627\u0644\u062A\u0635\u0646\u064A\u0639 \u0627\u0644\u0635\u064A\u0646\u064A \u064A\u0635\u0644 \u0625\u0644\u0649 \u062D\u0642\u0648\u0644 \u0627\u0644\u0639\u0627\u0644\u0645.",
        cta: "\u062A\u0642\u062F\u064A\u0645 \u0637\u0644\u0628 \u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0629",
        introTitle: "\u0627\u0644\u0645\u0646\u0635\u0629 \u0627\u0644\u0639\u0627\u0644\u0645\u064A\u0629 \u0644\u0644\u0622\u0644\u0627\u062A \u0627\u0644\u0632\u0631\u0627\u0639\u064A\u0629 \u0627\u0644\u0635\u064A\u0646\u064A\u0629",
        introBody: "\u0627\u0644\u0645\u0639\u0627\u0631\u0636 \u0627\u0644\u062A\u0642\u0644\u064A\u062F\u064A\u0629 \u062A\u0633\u062A\u0645\u0631 3 \u0623\u064A\u0627\u0645 \u0641\u064A \u0627\u0644\u0633\u0646\u0629. \u0646\u062D\u0646 \u0646\u0646\u0642\u0644 \u0627\u0644\u0645\u0639\u0631\u0636 \u0625\u0644\u0649 \u0627\u0644\u0625\u0646\u062A\u0631\u0646\u062A\u060C \u0646\u0639\u0631\u0636 \u0627\u0644\u0639\u0644\u0627\u0645\u0627\u062A \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629 \u0627\u0644\u0635\u064A\u0646\u064A\u0629 \u0644\u0644\u0645\u0634\u062A\u0631\u064A\u0646 \u0627\u0644\u0639\u0627\u0644\u0645\u064A\u064A\u0646 24/7/365. \u0627\u0644\u062C\u0646\u0627\u062D \u0627\u0644\u0635\u064A\u0646\u064A \u0647\u0648 \u0627\u0644\u0628\u0637\u0644 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u060C \u0627\u0644\u062C\u0646\u0627\u062D \u0627\u0644\u0639\u0627\u0644\u0645\u064A \u0647\u0648 \u0627\u0644\u0645\u0631\u062C\u0639\u060C \u0648\u0642\u0627\u0639\u0629 \u0627\u0644\u0645\u0642\u0627\u0631\u0646\u0629 \u062A\u0633\u0627\u0639\u062F \u0641\u064A \u0627\u062A\u062E\u0627\u0630 \u0627\u0644\u0642\u0631\u0627\u0631. \u062B\u0644\u0627\u062B\u0629 \u0623\u062C\u0646\u062D\u0629 \u0645\u0639\u0627\u064B: \u0645\u0646 \u0627\u0644\u0639\u0631\u0636 \u0625\u0644\u0649 \u0627\u0644\u0635\u0641\u0642\u0629. \u0645\u0639 \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0648\u0627\u0644\u062D\u0636\u0627\u0646\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0648\u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A\u0627\u062A \u0627\u0644\u062F\u0648\u0644\u064A\u0629.",
        featuresTitle: "\u0627\u0644\u0645\u0632\u0627\u064A\u0627 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629",
        features: [
            { icon: "clock", title: "365 \u064A\u0648\u0645\u0627\u064B \u0639\u0628\u0631 \u0627\u0644\u0625\u0646\u062A\u0631\u0646\u062A", desc: "\u0628\u062F\u0648\u0646 \u0642\u064A\u0648\u062F \u062C\u062F\u0648\u0644: \u0627\u0639\u0631\u0636 \u0648\u062D\u062F\u0651\u062B \u0648\u0628\u0650\u0639 \u0641\u064A \u0623\u064A \u0648\u0642\u062A" },
            { icon: "globe", title: "\u0648\u0635\u0648\u0644 \u0639\u0627\u0644\u0645\u064A", desc: "8 \u0644\u063A\u0627\u062A: \u0622\u0633\u064A\u0627 \u0627\u0644\u0648\u0633\u0637\u0649\u060C \u0623\u0648\u0631\u0648\u0628\u0627 \u0627\u0644\u0634\u0631\u0642\u064A\u0629\u060C \u062C\u0646\u0648\u0628 \u0634\u0631\u0642 \u0622\u0633\u064A\u0627\u060C \u0623\u0641\u0631\u064A\u0642\u064A\u0627\u060C \u0623\u0645\u0631\u064A\u0643\u0627 \u0627\u0644\u062C\u0646\u0648\u0628\u064A\u0629" },
            { icon: "bot", title: "\u0645\u0637\u0627\u0628\u0642\u0629 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A", desc: "\u0645\u062D\u0631\u0643 \u0630\u0643\u064A \u064A\u0637\u0627\u0628\u0642 \u0627\u0644\u0637\u0644\u0628 \u0645\u0639 \u0627\u0644\u0645\u062E\u0632\u0648\u0646\u060C \u064A\u0648\u0644\u0651\u062F \u0639\u0645\u0644\u0627\u0621 \u0645\u062D\u062A\u0645\u0644\u064A\u0646 \u0639\u0627\u0644\u064A \u0627\u0644\u0646\u064A\u0629" },
            { icon: "shield", title: "\u062D\u0636\u0627\u0646\u0629 \u062A\u062C\u0627\u0631\u064A\u0629", desc: "\u062D\u0636\u0627\u0646\u0629 \u0627\u0644\u0623\u0645\u0648\u0627\u0644\u060C \u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0641\u062D\u0635\u060C \u062A\u062A\u0628\u0639 \u0627\u0644\u0628\u0644\u0648\u0643 \u062A\u0634\u064A\u0646" },
            { icon: "trending", title: "\u0645\u062F\u0641\u0648\u0639 \u0628\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A", desc: "\u0645\u0624\u0634\u0631 \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0639\u0627\u0644\u0645\u064A\u060C \u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0633\u062A\u062E\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u0633\u0648\u0642" },
            { icon: "ship", title: "\u0644\u0648\u062C\u0633\u062A\u064A\u0627\u062A \u0639\u0627\u0628\u0631\u0629 \u0644\u0644\u062D\u062F\u0648\u062F", desc: "\u0645\u0633\u062A\u0648\u062F\u0639\u0627\u062A \u062E\u0627\u0631\u062C\u064A\u0629 + \u0644\u0648\u062C\u0633\u062A\u064A\u0627\u062A \u0645\u0646 \u0627\u0644\u0628\u0627\u0628 \u0625\u0644\u0649 \u0627\u0644\u0628\u0627\u0628" },
        ],
        benefitsTitle: "\u0645\u0632\u0627\u064A\u0627 \u0627\u0644\u0639\u0627\u0631\u0636",
        benefits: [
            "\u062C\u0646\u0627\u062D \u0627\u0641\u062A\u0631\u0627\u0636\u064A 365 \u064A\u0648\u0645\u0627\u064B \u0645\u0639 \u0639\u0631\u0636 \u0627\u0644\u0635\u0648\u0631 \u0648\u0627\u0644\u0641\u064A\u062F\u064A\u0648",
            "\u0645\u062D\u0631\u0643 \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u064A\u0639\u0637\u064A \u0627\u0644\u0623\u0648\u0644\u0648\u064A\u0629 \u0644\u0644\u0627\u0633\u062A\u0641\u0633\u0627\u0631\u0627\u062A \u0639\u0627\u0644\u064A\u0629 \u0627\u0644\u0646\u064A\u0629",
            "\u0635\u0641\u062D\u0627\u062A \u0627\u0644\u0645\u0646\u062A\u062C \u0628\u0640 8 \u0644\u063A\u0627\u062A",
            "\u062E\u062F\u0645\u0629 \u062D\u0636\u0627\u0646\u0629 \u0639\u0627\u0628\u0631\u0629 \u0644\u0644\u062D\u062F\u0648\u062F \u0644\u062D\u0645\u0627\u064A\u0629 \u0627\u0644\u0623\u0645\u0648\u0627\u0644",
            "\u062A\u0642\u0627\u0631\u064A\u0631 \u0634\u0647\u0631\u064A\u0629 \u0644\u0627\u0633\u062A\u062E\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u0633\u0648\u0642",
            "\u0648\u0635\u0648\u0644 \u0623\u0648\u0644\u0648\u064A \u0644\u0644\u0645\u0639\u0627\u0631\u0636 \u0627\u0644\u062D\u0636\u0648\u0631\u064A\u0629",
            "\u0642\u0646\u0627\u0629 \u062A\u0648\u0635\u064A\u0629 CAMDA",
            "\u062E\u0635\u0648\u0645\u0627\u062A \u062D\u0635\u0631\u064A\u0629 \u0639\u0644\u0649 \u0627\u0644\u0645\u0633\u062A\u0648\u062F\u0639\u0627\u062A \u0648\u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A\u0627\u062A",
        ],
        formTitle: "\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0627\u0633\u062A\u0641\u0633\u0627\u0631",
        formSubtitle: "\u0627\u0645\u0644\u0623 \u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0648\u0633\u0646\u062A\u0648\u0627\u0635\u0644 \u0645\u0639\u0643 \u062E\u0644\u0627\u0644 24 \u0633\u0627\u0639\u0629",
        fields: {
            company: "\u0627\u0633\u0645 \u0627\u0644\u0634\u0631\u0643\u0629",
            contact: "\u0634\u062E\u0635 \u0627\u0644\u0627\u062A\u0635\u0627\u0644",
            phone: "\u0627\u0644\u0647\u0627\u062A\u0641",
            email: "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A",
            country: "\u0627\u0644\u062F\u0648\u0644\u0629 / \u0627\u0644\u0645\u0646\u0637\u0642\u0629",
            category: "\u0627\u0644\u0641\u0626\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629",
            boothType: "\u0646\u0648\u0639 \u0627\u0644\u062C\u0646\u0627\u062D",
            message: "\u0631\u0633\u0627\u0644\u0629 (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)",
        },
        boothOptions: [
            "\u0623\u0633\u0627\u0633\u064A \u00A5380/\u0633\u0646\u0629 (5 \u0645\u0646\u062A\u062C\u0627\u062A)",
            "\u0645\u0645\u064A\u0632 \u00A5980/\u0633\u0646\u0629 (20 \u0645\u0646\u062A\u062C + \u0641\u064A\u062F\u064A\u0648)",
            "\u0631\u0627\u0626\u062F \u00A52,880/\u0633\u0646\u0629 (\u063A\u064A\u0631 \u0645\u062D\u062F\u0648\u062F + VR + \u0623\u0648\u0644\u0648\u064A\u0629)",
            "\u063A\u064A\u0631 \u0645\u062A\u0623\u0643\u062F\u060C \u062A\u0648\u0627\u0635\u0644 \u0645\u0639\u064A",
        ],
        categoryOptions: [
            "\u062C\u0631\u0627\u0631\u0627\u062A",
            "\u062D\u0635\u0627\u062F\u0627\u062A \u0627\u0644\u0623\u0639\u0644\u0627\u0641",
            "\u0622\u0644\u0627\u062A \u0627\u0644\u062D\u0632\u0645",
            "\u0631\u0624\u0648\u0633 \u0627\u0644\u062D\u0635\u0627\u062F",
            "\u0622\u0644\u0627\u062A \u0627\u0644\u062A\u063A\u0644\u064A\u0641",
            "\u0645\u062C\u0627\u062F\u0628 / \u0646\u0627\u0634\u0631\u0627\u062A",
            "\u0642\u0637\u0639 \u063A\u064A\u0627\u0631",
            "\u0622\u0644\u0627\u062A \u0623\u062E\u0631\u0649",
        ],
        submit: "\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0637\u0644\u0628",
        submitting: "\u062C\u0627\u0631\u064A \u0627\u0644\u0625\u0631\u0633\u0627\u0644...",
        success: "\u062A\u0645 \u0627\u0644\u0625\u0631\u0633\u0627\u0644 \u0628\u0646\u062C\u0627\u062D! \u0633\u0646\u062A\u0648\u0627\u0635\u0644 \u0645\u0639\u0643 \u062E\u0644\u0627\u0644 24 \u0633\u0627\u0639\u0629.",
        error: "\u0641\u0634\u0644 \u0627\u0644\u0625\u0631\u0633\u0627\u0644. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0623\u0648 \u062A\u0648\u0627\u0635\u0644 \u0639\u0628\u0631 WhatsApp: +86 15511395016",
        selectPlaceholder: "\u0627\u062E\u062A\u0631",
    },
    fr: {
        badge: "Machinerie Chinoise \u00B7 Sc\u00E8ne Mondiale",
        title: "Expo Mondiale de Machinerie Agricole Toujours Active",
        subtitle: "125 marques chinoises de machinerie agricole avec mod\u00E8les phares en exposition 365 jours par an. De Dongfanghong \u00E0 DJI, des tracteurs aux drones: la fabrication chinoise atteint les champs du monde.",
        cta: "Demander \u00E0 Participer",
        introTitle: "La Sc\u00E8ne Mondiale pour la Machinerie Agricole Chinoise",
        introBody: "Les expos traditionnelles durent 3 jours par an. Nous transf\u00E9rons l'expo en ligne, pr\u00E9sentant les marques chinoises aux acheteurs mondiaux 24/7/365. Le Pavillon Chinois est le protagoniste, le Pavillon Global est la r\u00E9f\u00E9rence, et la Salle de Comparaison aide \u00E0 d\u00E9cider. Trois pavillons ensemble: de l'exposition \u00E0 la transaction. Avec le matching IA, la s\u00E9questre transfrontali\u00E8re et la logistique internationale.",
        featuresTitle: "Points Forts",
        features: [
            { icon: "clock", title: "365 Jours en Ligne", desc: "Sans limites d'horaire: exposez, mettez \u00E0 jour, vendez \u00E0 tout moment" },
            { icon: "globe", title: "Port\u00E9e Mondiale", desc: "8 langues: Asie Centrale, Europe de l'Est, Asie du Sud-Est, Afrique, Am\u00E9rique du Sud" },
            { icon: "bot", title: "Matching IA", desc: "Moteur intelligent connectant demande et stock, g\u00E9n\u00E9rant des leads qualifi\u00E9s" },
            { icon: "shield", title: "S\u00E9questre Commerciale", desc: "Custodie des fonds, rapports d'inspection, tra\u00E7abilit\u00E9 blockchain" },
            { icon: "trending", title: "Pilot\u00E9 par les Donn\u00E9es", desc: "Indice mondial des prix, rapports d'intelligence march\u00E9" },
            { icon: "ship", title: "Logistique Transfrontali\u00E8re", desc: "Entrep\u00F4ts \u00E0 l'\u00E9tranger + logistique porte \u00E0 porte avec visibilit\u00E9 totale" },
        ],
        benefitsTitle: "Avantages de l'Exposant",
        benefits: [
            "Stand virtuel 365 jours avec exposition photos et vid\u00E9o",
            "Moteur de matching IA priorise les demandes qualifi\u00E9es",
            "Pages produit en 8 langues",
            "Service de s\u00E9questre transfrontali\u00E8re pour fonds s\u00E9curis\u00E9s",
            "Rapports mensuels d'intelligence march\u00E9",
            "Acc\u00E8s prioritaire aux expos physiques",
            "Canal de recommandation CAMDA",
            "Remises exclusives sur entrep\u00F4ts et logistique",
        ],
        formTitle: "Formulaire de Demande",
        formSubtitle: "Remplissez le formulaire et nous vous contacterons sous 24 heures",
        fields: {
            company: "Nom de l'Entreprise",
            contact: "Personne de Contact",
            phone: "T\u00E9l\u00E9phone",
            email: "Email",
            country: "Pays / R\u00E9gion",
            category: "Cat\u00E9gorie Principale",
            boothType: "Type de Stand",
            message: "Message (Optionnel)",
        },
        boothOptions: [
            "Basique \u00A5380/an (5 produits)",
            "Premium \u00A5980/an (20 produits + vid\u00E9o)",
            "Phare \u00A52,880/an (illimit\u00E9 + VR + priorit\u00E9)",
            "Pas s\u00FBr, contactez-moi",
        ],
        categoryOptions: [
            "Tracteurs",
            "R\u00E9colteuses d'Ensilage",
            "Presse \u00E0 Balles",
            "T\u00EAtes de R\u00E9colte",
            "Enrubanneuses",
            "R\u00E2teaux / Faneuses",
            "Pi\u00E8ces",
            "Autre Machinerie",
        ],
        submit: "Envoyer la Demande",
        submitting: "Envoi...",
        success: "Envoy\u00E9 avec succ\u00E8s! Nous vous contacterons sous 24 heures.",
        error: "\u00C9chec de l'envoi. R\u00E9essayez ou contactez Email: 932133255@qq.com",
        selectPlaceholder: "S\u00E9lectionner",
    },
    hi: {
        badge: "\u091A\u0940\u0928\u0940 \u092E\u0936\u0940\u0928\u0930\u0940 \u00B7 \u0935\u0948\u0936\u094D\u0935\u093F\u0915 \u092E\u0902\u091A",
        title: "\u0939\u092E\u0947\u0936\u093E \u091A\u093E\u0932\u0942 \u0935\u093F\u0936\u094D\u0935 \u0915\u0943\u0937\u093F \u092E\u0936\u0940\u0928\u0930\u0940 \u090F\u0915\u094D\u0938\u092A\u094B",
        subtitle: "125 \u091A\u0940\u0928\u0940 \u0915\u0943\u0937\u093F \u092E\u0936\u0940\u0928\u0930\u0940 \u092C\u094D\u0930\u093E\u0902\u0921 365 \u0926\u093F\u0928\u094B\u0902 \u0924\u0915 \u092B\u094D\u0932\u0948\u0917\u0936\u093F\u092A \u092E\u0949\u0921\u0932 \u092A\u094D\u0930\u0926\u0930\u094D\u0936\u093F\u0924\u0964 \u0921\u094B\u0902\u0917\u092B\u093E\u0902\u0917\u0939\u094B\u0902\u0917 \u0938\u0947 DJI \u0924\u0915, \u091F\u094D\u0930\u0948\u0915\u094D\u091F\u0930 \u0938\u0947 \u0921\u094D\u0930\u094B\u0928 \u0924\u0915 \u2014 \u091A\u0940\u0928\u0940 \u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0926\u0941\u0928\u093F\u092F\u093E \u0915\u0947 \u0916\u0947\u0924\u094B\u0902 \u0924\u0915\u0964",
        cta: "\u092D\u093E\u0917 \u0932\u0947\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u0906\u0935\u0947\u0926\u0928 \u0915\u0930\u0947\u0902",
        introTitle: "\u091A\u0940\u0928\u0940 \u0915\u0943\u0937\u093F \u092E\u0936\u0940\u0928\u0930\u0940 \u0915\u0947 \u0932\u093F\u090F \u0935\u093F\u0936\u094D\u0935 \u092E\u0902\u091A",
        introBody: "\u092A\u093E\u0930\u0902\u092A\u0930\u093F\u0915 \u090F\u0915\u094D\u0938\u092A\u094B \u0938\u093E\u0932 \u092E\u0947\u0902 3 \u0926\u093F\u0928 \u091A\u0932\u0924\u0947 \u0939\u0948\u0902\u0964 \u0939\u092E \u090F\u0915\u094D\u0938\u092A\u094B \u0915\u094B \u0911\u0928\u0932\u093E\u0907\u0928 \u0932\u093E\u0924\u0947 \u0939\u0948\u0902, \u091A\u0940\u0928\u0940 \u092C\u094D\u0930\u093E\u0902\u0921\u094D\u0938 \u0915\u094B \u0935\u0948\u0936\u094D\u0935\u093F\u0915 \u0916\u0930\u0940\u0926\u093E\u0930\u094B\u0902 \u0915\u0947 \u0932\u093F\u090F 24/7/365 \u092A\u094D\u0930\u0926\u0930\u094D\u0936\u093F\u0924 \u0915\u0930\u0924\u0947 \u0939\u0948\u0902\u0964 \u091A\u093E\u0907\u0928\u093E \u092A\u0935\u093F\u0932\u093F\u092F\u0928 \u092E\u0941\u0916\u094D\u092F \u0915\u0932\u093E\u0915\u093E\u0930 \u0939\u0948, \u0917\u094D\u0932\u094B\u092C\u0932 \u092A\u0935\u093F\u0932\u093F\u092F\u0928 \u0938\u0902\u0926\u0930\u094D\u092D \u0939\u0948, \u0914\u0930 \u0924\u0941\u0932\u0928\u093E \u0939\u0949\u0932 \u0928\u093F\u0930\u094D\u0923\u092F \u092E\u0947\u0902 \u092E\u0926\u0926 \u0915\u0930\u0924\u093E \u0939\u0948\u0964 \u0924\u0940\u0928 \u092A\u0935\u093F\u0932\u093F\u092F\u0928 \u092E\u093F\u0932\u0915\u0930: \u092A\u094D\u0930\u0926\u0930\u094D\u0936\u0928 \u0938\u0947 \u0921\u0940\u0932 \u0924\u0915\u0964 AI \u092E\u0948\u091A\u093F\u0902\u0917, \u0915\u094D\u0930\u0949\u0938-\u092C\u0949\u0930\u094D\u0921\u0930 \u090F\u0938\u094D\u0915\u094D\u0930\u094B \u0914\u0930 \u0905\u0902\u0924\u0930\u0930\u093E\u0937\u094D\u091F\u094D\u0930\u0940\u092F \u0930\u0938\u0926 \u0915\u0947 \u0938\u093E\u0925\u0964",
        featuresTitle: "\u092E\u0941\u0916\u094D\u092F \u0935\u093F\u0936\u0947\u0937\u0924\u093E\u090F\u0902",
        features: [
            { icon: "clock", title: "365 \u0926\u093F\u0928 \u0911\u0928\u0932\u093E\u0907\u0928", desc: "\u0936\u0947\u0921\u094D\u092F\u0942\u0932 \u0915\u0940 \u0915\u094B\u0908 \u0938\u0940\u092E\u093E \u0928\u0939\u0940\u0902 \u2014 \u0915\u092D\u0940 \u092D\u0940 \u092A\u094D\u0930\u0926\u0930\u094D\u0936\u093F\u0924 \u0915\u0930\u0947\u0902, \u0905\u092A\u0921\u0947\u091F \u0915\u0930\u0947\u0902, \u092C\u0947\u091A\u0947\u0902" },
            { icon: "globe", title: "\u0935\u0948\u0936\u094D\u0935\u093F\u0915 \u092A\u0939\u0941\u0902\u091A", desc: "8 \u092D\u093E\u0937\u093E\u090F\u0902: \u092E\u0927\u094D\u092F \u090F\u0936\u093F\u092F\u093E, \u092A\u0942\u0930\u094D\u0935\u0940 \u092F\u0942\u0930\u094B\u092A, \u0926\u0915\u094D\u0937\u093F\u0923 \u092A\u0942\u0930\u094D\u0935 \u090F\u0936\u093F\u092F\u093E, \u0905\u092B\u094D\u0930\u0940\u0915\u093E, \u0926\u0915\u094D\u0937\u093F\u0923 \u0905\u092E\u0947\u0930\u093F\u0915\u093E" },
            { icon: "bot", title: "AI \u092E\u0948\u091A\u093F\u0902\u0917", desc: "\u0938\u094D\u092E\u093E\u0930\u094D\u091F \u0907\u0902\u091C\u0928 \u092E\u093E\u0902\u0917 \u0915\u094B \u0907\u0928\u094D\u0935\u0947\u0902\u091F\u094D\u0930\u0940 \u0938\u0947 \u091C\u094B\u0921\u093C\u0924\u093E \u0939\u0948, \u0909\u091A\u094D\u091A-\u0907\u0930\u093E\u0926\u093E \u0932\u0940\u0921\u094D\u0938 \u092D\u0947\u091C\u0924\u093E \u0939\u0948" },
            { icon: "shield", title: "\u090F\u0938\u094D\u0915\u094D\u0930\u094B \u0938\u0941\u0930\u0915\u094D\u0937\u093E", desc: "\u092B\u0902\u0921 \u0915\u0938\u094D\u091F\u0921\u0940, \u0928\u093F\u0930\u0940\u0915\u094D\u0937\u0923 \u0930\u093F\u092A\u094B\u0930\u094D\u091F, \u092C\u094D\u0932\u0949\u0915\u091A\u0947\u0928 \u091F\u094D\u0930\u0947\u0938\u092C\u093F\u0932\u093F\u091F\u0940" },
            { icon: "trending", title: "\u0921\u0947\u091F\u093E-\u0938\u0902\u091A\u093E\u0932\u093F\u0924", desc: "\u0935\u0948\u0936\u094D\u0935\u093F\u0915 \u092E\u0942\u0932\u094D\u092F \u0938\u0942\u091A\u0915\u093E\u0902\u0915, \u092C\u093E\u091C\u093E\u0930 \u0916\u0941\u092B\u093F\u092F\u093E \u0930\u093F\u092A\u094B\u0930\u094D\u091F\u0947\u0902" },
            { icon: "ship", title: "\u0915\u094D\u0930\u0949\u0938-\u092C\u0949\u0930\u094D\u0921\u0930 \u0930\u0938\u0926", desc: "\u0935\u093F\u0926\u0947\u0936\u0940 \u0917\u094B\u0926\u093E\u092E + \u0926\u0930\u0935\u093E\u091C\u0947 \u0938\u0947 \u0926\u0930\u0935\u093E\u091C\u0947 \u0930\u0938\u0926, \u092A\u0942\u0930\u094D\u0923 \u0926\u0943\u0936\u094D\u092F\u0924\u093E" },
        ],
        benefitsTitle: "\u092A\u094D\u0930\u0926\u0930\u094D\u0936\u0915 \u0932\u093E\u092D",
        benefits: [
            "365-\u0926\u093F\u0928 \u0935\u0930\u094D\u091A\u0941\u0905\u0932 \u092C\u0942\u0925, \u092B\u094B\u091F\u094B + \u0935\u0940\u0921\u093F\u092F\u094B \u092A\u094D\u0930\u0926\u0930\u094D\u0936\u0928 \u0915\u0947 \u0938\u093E\u0925",
            "AI \u092E\u0948\u091A\u093F\u0902\u0917 \u0907\u0902\u091C\u0928 \u0909\u091A\u094D\u091A-\u0907\u0930\u093E\u0926\u093E \u0916\u0930\u0940\u0926\u093E\u0930 \u092A\u0942\u091B\u0924\u093E\u091B \u0915\u094B \u092A\u094D\u0930\u093E\u0925\u092E\u093F\u0915\u0924\u093E \u0926\u0947\u0924\u093E \u0939\u0948",
            "8 \u092D\u093E\u0937\u093E\u0913\u0902 \u092E\u0947\u0902 \u0909\u0924\u094D\u092A\u093E\u0926 \u0935\u093F\u0935\u0930\u0923 \u092A\u0943\u0937\u094D\u0920",
            "\u0938\u0941\u0930\u0915\u094D\u0937\u093F\u0924 \u092B\u0902\u0921 \u0938\u0941\u0930\u0915\u094D\u0937\u093E \u0915\u0947 \u0932\u093F\u090F \u0915\u094D\u0930\u0949\u0938-\u092C\u0949\u0930\u094D\u0921\u0930 \u090F\u0938\u094D\u0915\u094D\u0930\u094B \u0938\u0947\u0935\u093E",
            "\u092E\u093E\u0938\u093F\u0915 \u092C\u093E\u091C\u093E\u0930 \u0916\u0941\u092B\u093F\u092F\u093E \u0930\u093F\u092A\u094B\u0930\u094D\u091F\u0947\u0902",
            "\u0911\u092B\u0932\u093E\u0907\u0928 \u092B\u0940\u0932\u094D\u0921 \u090F\u0915\u094D\u0938\u092A\u094B \u092E\u0947\u0902 \u092A\u094D\u0930\u093E\u0925\u092E\u093F\u0915\u0924\u093E \u092A\u0939\u0941\u0902\u091A",
            "CAMDA \u0938\u0926\u0938\u094D\u092F \u0930\u0947\u092B\u0930\u0932 \u091A\u0948\u0928\u0932",
            "\u0917\u094B\u0926\u093E\u092E \u0914\u0930 \u0930\u0938\u0926 \u092A\u0930 \u0935\u093F\u0936\u0947\u0937 \u091B\u0942\u091F",
        ],
        formTitle: "\u092A\u0942\u091B\u0924\u093E\u091B \u092B\u0949\u0930\u094D\u092E",
        formSubtitle: "\u092B\u0949\u0930\u094D\u092E \u092D\u0930\u0947\u0902 \u0914\u0930 \u0939\u092E 24 \u0918\u0902\u091F\u0947 \u092E\u0947\u0902 \u0938\u0902\u092A\u0930\u094D\u0915 \u0915\u0930\u0947\u0902\u0917\u0947",
        fields: {
            company: "\u0915\u0902\u092A\u0928\u0940 \u0915\u093E \u0928\u093E\u092E",
            contact: "\u0938\u0902\u092A\u0930\u094D\u0915 \u0935\u094D\u092F\u0915\u094D\u0924\u093F",
            phone: "\u092B\u094B\u0928 \u0928\u0902\u092C\u0930",
            email: "\u0908\u092E\u0947\u0932",
            country: "\u0926\u0947\u0936 / \u0915\u094D\u0937\u0947\u0924\u094D\u0930",
            category: "\u092E\u0941\u0916\u094D\u092F \u0936\u094D\u0930\u0947\u0923\u0940",
            boothType: "\u092C\u0942\u0925 \u092A\u094D\u0930\u0915\u093E\u0930",
            message: "\u0938\u0902\u0926\u0947\u0936 (\u0935\u0948\u0915\u0932\u094D\u092A\u093F\u0915)",
        },
        boothOptions: [
            "\u092C\u0947\u0938\u093F\u0915 \u00A5380/\u0935\u0930\u094D\u0937 (5 \u0909\u0924\u094D\u092A\u093E\u0926)",
            "\u092A\u094D\u0930\u0940\u092E\u093F\u092F\u092E \u00A5980/\u0935\u0930\u094D\u0937 (20 \u0909\u0924\u094D\u092A\u093E\u0926 + \u0935\u0940\u0921\u093F\u092F\u094B)",
            "\u092B\u094D\u0932\u0948\u0917\u0936\u093F\u092A \u00A52,880/\u0935\u0930\u094D\u0937 (\u0905\u0938\u0940\u092E\u093F\u0924 + VR + \u092A\u094D\u0930\u093E\u0925\u092E\u093F\u0915\u0924\u093E)",
            "\u0928\u093F\u0936\u094D\u091A\u093F\u0924 \u0928\u0939\u0940\u0902, \u092E\u0941\u091D\u0938\u0947 \u0938\u0902\u092A\u0930\u094D\u0915 \u0915\u0930\u0947\u0902",
        ],
        categoryOptions: [
            "\u091F\u094D\u0930\u0948\u0915\u094D\u091F\u0930",
            "\u091A\u093E\u0930\u093E \u0915\u091F\u093E\u0908 \u092E\u0936\u0940\u0928",
            "\u092C\u0947\u0932\u0930",
            "\u0939\u0947\u0921\u0930 / \u092A\u093F\u0915\u0905\u092A \u0939\u0947\u0921",
            "\u092C\u0947\u0932 \u0930\u0948\u092A\u0930",
            "\u0930\u0947\u0915 / \u091F\u0947\u0921\u0930",
            "\u092A\u093E\u0930\u094D\u091F\u094D\u0938",
            "\u0905\u0928\u094D\u092F \u092E\u0936\u0940\u0928\u0930\u0940",
        ],
        submit: "\u0906\u0935\u0947\u0926\u0928 \u092D\u0947\u091C\u0947\u0902",
        submitting: "\u092D\u0947\u091C\u093E \u091C\u093E \u0930\u0939\u093E \u0939\u0948...",
        success: "\u0938\u092B\u0932\u0924\u093E\u092A\u0942\u0930\u094D\u0935\u0915 \u092D\u0947\u091C\u093E \u0917\u092F\u093E! \u0939\u092E 24 \u0918\u0902\u091F\u0947 \u092E\u0947\u0902 \u0938\u0902\u092A\u0930\u094D\u0915 \u0915\u0930\u0947\u0902\u0917\u0947\u0964",
        error: "\u092D\u0947\u091C\u0928\u093E \u0935\u093F\u092B\u0932\u0964 \u092A\u0941\u0928\u0903 \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0902 \u092F\u093E WhatsApp: +86 15511395016 \u092A\u0930 \u0938\u0902\u092A\u0930\u094D\u0915 \u0915\u0930\u0947\u0902",
        selectPlaceholder: "\u091A\u0941\u0928\u0947\u0902",
    },
};
}
// .com 全球叙事覆盖：仅 .com 生效，主语从"中国农机"切换为"全球农机"；
// .cn 保留中国供给端叙事（沿用 TEXTS[locale]）。两站共用母品牌名 Shendiao Agri-Machinery Expo™。
function getGLOBAL_NARRATIVE(tr: (s: string) => string): Record<string, {
    badge: string;
    title: string;
    subtitle: string;
    introTitle: string;
    introBody: string;
}> {
  return {
    zh: {
        badge: "\u5168\u7403\u519C\u673A\u535A\u89C8\u4F1A \u00B7 \u8BA9\u5168\u7403\u519C\u673A\u8D70\u5411\u4E16\u754C",
        title: tr("永不落幕的全球农机博览会"),
        subtitle: "\u5168\u7403\u519C\u673A\u54C1\u724C 365 \u5929\u5728\u7EBF\u5C55\u793A\uFF0C\u4ECE\u7EA6\u7FF0\u8FEA\u5C14\u5230\u5927\u7586\uFF0C\u4ECE\u62D6\u62C9\u673A\u5230\u690D\u4FDD\u65E0\u4EBA\u673A\u2014\u2014\u6C47\u805A\u5168\u7403\u4F9B\u7ED9\uFF0C\u670D\u52A1\u5168\u7403\u4E70\u5BB6\u3002",
        introTitle: "\u5168\u7403\u519C\u673A\u7684\u4E16\u754C\u821E\u53F0",
        introBody: "\u4F20\u7EDF\u5C55\u4F1A\u4E00\u5E74 3 \u5929\uFF0C\u9519\u8FC7\u7B49\u4E00\u5E74\u3002\u6211\u4EEC\u628A\u5C55\u4F1A\u642C\u5230\u7EBF\u4E0A\uFF0C\u8BA9\u5168\u7403\u519C\u673A\u54C1\u724C 365 \u5929 24 \u5C0F\u65F6\u5411\u5168\u7403\u4E70\u5BB6\u5C55\u793A\u3002\u5168\u7403\u9886\u8896\u9986\u4E3A\u65D7\u8230\uFF0C\u4E2D\u56FD\u4E2D\u575A\u9986\u4E3A\u6838\u5FC3\u4F9B\u7ED9\uFF0C\u65B0\u9510\u4E13\u4E1A\u9986\u4E3A\u8865\u5145\u2014\u2014\u4E09\u9986\u8054\u52A8\uFF0C\u6309\u54C1\u724C\u5168\u7403\u5F71\u54CD\u529B\u5BA2\u89C2\u5206\u7EA7\u3002\u7ED3\u5408 AI \u4F9B\u9700\u5339\u914D\u3001\u8DE8\u5883\u4EA4\u6613\u62C5\u4FDD\u4E0E\u56FD\u9645\u7269\u6D41\uFF0C\u8BA9\u5168\u7403\u519C\u673A\u8D70\u5411\u6BCF\u4E00\u5757\u519C\u7530\u3002",
    },
    en: {
        badge: "Global Agri-Machinery Expo \u2014 The World's Farm Machinery, Connected",
        title: "The Always-On Global Agri-Machinery Expo",
        subtitle: "Verified machinery brands from China and beyond, on display 365 days a year \u2014 from John Deere to DJI, from tractors to drones. A global supply meeting global buyers.",
        introTitle: "A Global Stage for the World's Farm Machinery",
        introBody: "Traditional expos last 3 days a year \u2014 miss it and wait another year. We bring the expo online, showcasing verified machinery brands from around the world to international buyers 24/7/365. The Global Leaders Hall is the flagship, the China Backbone Hall is the core supply mix, and the Rising Innovators Hall is the curated supplement \u2014 three halls working together, tiered objectively by global brand influence. Combined with AI matching, cross-border escrow, and international logistics, we bring the world's farm machinery to every field.",
    },
};
}
export function ExpoLanding({ locale }: ExpoLandingProps) {
  const tr = useTr();
        const cn = isCnSite();
    const base = getTEXTS(tr)[locale] || getTEXTS(tr).zh;
    const narrative = cn ? null : getGLOBAL_NARRATIVE(tr)[locale] || getGLOBAL_NARRATIVE(tr).en;
    const t = narrative ? { ...base, ...narrative } : base;
    const expoTitle = cn && locale === "zh" ? "\u795E\u96D5\u519C\u673A\u5C55\u2122\u2014\u2014\u4E2D\u56FD\u519C\u673A\u7684\u4E16\u754C\u821E\u53F0" : t.title;
    const [formData, setFormData] = useState({
        company: "",
        contact: "",
        phone: "",
        email: "",
        country: "",
        category: "",
        boothType: "",
        message: "",
    });
    const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus("submitting");
        try {
            const res = await fetch("/api/expo/inquiry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...formData, locale }),
            });
            if (!res.ok)
                throw new Error("submit failed");
            setStatus("success");
            setFormData({
                company: "",
                contact: "",
                phone: "",
                email: "",
                country: "",
                category: "",
                boothType: "",
                message: "",
            });
        }
        catch {
            setStatus("error");
        }
    };
    return (<div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-red-50 via-amber-50 to-yellow-50">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 h-40 w-40 rounded-full bg-red-300 blur-3xl"/>
          <div className="absolute bottom-10 right-10 h-60 w-60 rounded-full bg-amber-300 blur-3xl"/>
        </div>
        <div className="relative mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 md:py-28 lg:px-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-red-100 px-4 py-1.5 text-sm font-medium text-red-700">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-red-500"/>
            {t.badge}
          </div>
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            {expoTitle}
          </h1>
          <p className="mx-auto mb-10 max-w-3xl text-lg text-gray-600 sm:text-xl">
            {t.subtitle}
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a href="#inquiry-form">
              <Button size="lg" className="w-full bg-red-600 hover:bg-red-700 sm:w-auto">
                {t.cta}
                <ArrowRight className="ml-2 h-4 w-4"/>
              </Button>
            </a>
            <Link href={`/${locale}/expo/showroom`}>
              <Button size="lg" variant="outline" className="w-full border-red-600 text-red-700 hover:bg-red-50 sm:w-auto">
                {locale === "zh" ? "\u8FDB\u5165\u7EBF\u4E0A\u5C55\u5385" : locale === "ru" ? "\u0412\u043E\u0439\u0442\u0438 \u0432 \u0448\u043E\u0443\u0440\u0443\u043C" : "Enter Showroom"}
              </Button>
            </Link>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CheckCircle2 className="h-4 w-4 text-green-500"/>
              {locale === "zh" ? "187\u53F0\u4E2D\u5916\u7CBE\u54C1\u519C\u673A\u5728\u7EBF\u5C55\u793A" : locale === "ru" ? "187 \u043A\u0438\u0442\u0430\u0439\u0441\u043A\u0438\u0445 \u0438 \u043C\u0438\u0440\u043E\u0432\u044B\u0445 \u043C\u0430\u0448\u0438\u043D" : "187 Chinese & global machines on display"}
            </div>
          </div>
        </div>
      </section>

      {/* Introduction */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-3xl font-bold text-gray-900">{t.introTitle}</h2>
        <p className="text-lg leading-relaxed text-gray-600">{t.introBody}</p>
      </section>

      {/* Three Pavilions Entry (value-tiered, not nationality-based) */}
      <section className="bg-gradient-to-b from-gray-50 to-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Global Leaders Hall */}
            <Link href={`/${locale}/expo/global-brands`} className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 to-red-700 p-8 text-white shadow-lg transition-all hover:shadow-2xl hover:scale-[1.02]">
              <div className="absolute top-4 right-4 text-6xl opacity-20">🏆</div>
              <h3 className="mb-2 text-2xl font-bold">
                {locale === "zh" ? "\u5168\u7403\u9886\u8896\u9986" : locale === "ru" ? "\u0417\u0430\u043B \u043C\u0438\u0440\u043E\u0432\u044B\u0445 \u043B\u0438\u0434\u0435\u0440\u043E\u0432" : "Global Leaders Hall"}
              </h3>
              <p className="text-sm text-red-100">
                {locale === "zh"
            ? "12+\u5168\u7403\u519C\u673A\u5DE8\u5934\uFF1AJohn Deere\u3001CLAAS\u3001Fendt\u3001\u4E45\u4FDD\u7530\u3001\u79D1\u7F57\u5C3C\u2014\u2014\u5168\u7403\u884C\u4E1ANO.1\u54C1\u724C\u6807\u5FD7\u673A\u578B"
            : locale === "ru"
                ? "12+ \u0432\u0435\u0434\u0443\u0449\u0438\u0445 \u043C\u0438\u0440\u043E\u0432\u044B\u0445 \u0431\u0440\u0435\u043D\u0434\u043E\u0432: John Deere, CLAAS, Fendt, Kubota, Krone"
                : "12+ global giants: John Deere, CLAAS, Fendt, Kubota, Krone"}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-medium">
                {locale === "zh" ? "\u8FDB\u5165\u9886\u8896\u9986" : locale === "ru" ? "\u0412\u043E\u0439\u0442\u0438" : "Enter"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1"/>
              </div>
            </Link>

            {/* China Backbone Hall */}
            <Link href={`/${locale}/expo/china-brands`} className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-600 to-orange-700 p-8 text-white shadow-lg transition-all hover:shadow-2xl hover:scale-[1.02]">
              <div className="absolute top-4 right-4 text-6xl opacity-20">🏭</div>
              <h3 className="mb-2 text-2xl font-bold">
                {locale === "zh" ? "\u4E2D\u56FD\u4E2D\u575A\u9986" : locale === "ru" ? "\u0417\u0430\u043B \u043E\u0442\u0440\u0430\u0441\u043B\u0435\u0432\u044B\u0445 \u043B\u0438\u0434\u0435\u0440\u043E\u0432" : "China Backbone Hall"}
              </h3>
              <p className="text-sm text-amber-100">
                {locale === "zh"
            ? "\u4E1C\u65B9\u7EA2YTO\u3001\u96F7\u6C83\u3001\u6C83\u5F97\u3001\u4E2D\u8054\u3001\u9A6C\u6052\u8FBE\u7B49\u884C\u4E1A\u8170\u90E8\u54C1\u724C\uFF0C\u5BF9\u6807\u5168\u7403\u7684\u5F3A\u8005"
            : locale === "ru"
                ? "YTO, Lovol, World, Zoomlion, Mahindra \u2014 \u043A\u0440\u0443\u043F\u043D\u044B\u0435 \u0440\u0435\u0433\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0435 \u0438\u0433\u0440\u043E\u043A\u0438"
                : "YTO, Lovol, World, Zoomlion, Mahindra \u2014 proven China-based suppliers"}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-medium">
                {locale === "zh" ? "\u8FDB\u5165\u4E2D\u575A\u9986" : locale === "ru" ? "\u0412\u043E\u0439\u0442\u0438" : "Enter"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1"/>
              </div>
            </Link>

            {/* Rising Innovators Hall */}
            <Link href={`/${locale}/expo/showroom?pavilion=rising_specialty`} className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 p-8 text-white shadow-lg transition-all hover:shadow-2xl hover:scale-[1.02]">
              <div className="absolute top-4 right-4 text-6xl opacity-20">🚀</div>
              <h3 className="mb-2 text-2xl font-bold">
                {locale === "zh" ? "\u65B0\u9510\u4E13\u4E1A\u9986" : locale === "ru" ? "\u0417\u0430\u043B \u043D\u043E\u0432\u044B\u0445 \u0431\u0440\u0435\u043D\u0434\u043E\u0432" : "Rising Innovators Hall"}
              </h3>
              <p className="text-sm text-blue-100">
                {locale === "zh"
            ? "\u5927\u7586\u519C\u4E1A\u3001\u6781\u98DE\u79D1\u6280\u3001\u4E13\u4E1A\u7EC6\u5206\u54C1\u724C\u3001\u65B0\u9510\u56FD\u8D27\u2014\u2014\u6309\u54C1\u7C7B\u7CBE\u6311\u7EC6\u9009"
            : locale === "ru"
                ? "DJI, XAG, \u043F\u0440\u043E\u0444\u0438\u043B\u044C\u043D\u044B\u0435 \u0431\u0440\u0435\u043D\u0434\u044B \u0438 \u043D\u0438\u0448\u0435\u0432\u044B\u0435 \u0438\u0433\u0440\u043E\u043A\u0438"
                : "DJI, XAG, specialty brands & niche players"}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-medium">
                {locale === "zh" ? "\u8FDB\u5165\u65B0\u9510\u9986" : locale === "ru" ? "\u0412\u043E\u0439\u0442\u0438" : "Enter"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1"/>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ShenDiao Expo — dual-site framing */}
      {cn ? (<section className="bg-gradient-to-br from-green-700 via-green-600 to-emerald-700 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-bold text-white">
                {locale === "zh" ? "\u795E\u96D5\u5C55 \u00B7 \u56DB\u6863\u670D\u52A1" : "ShenDiao Expo \u00B7 4 Tiers"}
              </h2>
              <p className="mt-2 text-green-100">
                {locale === "zh"
                ? "\u5730\u5934\u5C55\u514D\u8D39\u53C2\u52A0 \u2192 \u73B0\u573A\u4E86\u89E3\u795E\u96D5\u5C55 \u2192 \u9009\u6863\u5F00\u901A"
                : "Free field expo \u2192 Explore ShenDiao Expo \u2192 Choose your tier"}
              </p>
            </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
            {[
                {
                    name: locale === "zh" ? "\uD83C\uDD93 \u514D\u8D39\u7248" : "\uD83C\uDD93 Free",
                    price: "\u00A50",
                    tag: locale === "zh" ? "\u514D\u8D39\u5F00\u901A" : "Free",
                    items: locale === "zh"
                        ? ["\u54C1\u724C\u6536\u5F55309\u5E93", "3\u53F0\u4E2D\u6587\u4E0A\u7EBF", "\u57FA\u7840\u6D4F\u89C8\u6570\u636E", "\u88AB\u52A8\u63A5\u6536\u8BE2\u76D8"]
                        : ["Brand listing", "3 products CN", "Basic views", "Passive inquiries"],
                    color: "bg-white/10",
                    priceColor: "text-green-200",
                },
                {
                    name: locale === "zh" ? "\uD83D\uDFE2 \u6807\u51C6\u7248" : "\uD83D\uDFE2 Standard",
                    price: "\u00A5188",
                    tag: locale === "zh" ? "\u8BD5\u6C34\u5165\u95E8" : "Entry",
                    items: locale === "zh"
                        ? ["\u54C1\u724C\u6545\u4E8B\u9875", "10\u53F0\u00B7\u914D\u4EF6\u5339\u914D", "\u67E5\u770B\u6D4F\u89C8\u6570\u636E", "\u63A5\u6536\u4E70\u5BB6\u8BE2\u4EF7"]
                        : ["Brand story", "10+ parts match", "View analytics", "Receive inquiries"],
                    color: "bg-white/15 ring-2 ring-green-300",
                    priceColor: "text-white",
                },
                {
                    name: locale === "zh" ? "\uD83D\uDFE1 \u4F18\u9009\u7248" : "\uD83D\uDFE1 Premium",
                    price: "\u00A5288",
                    tag: locale === "zh" ? "\u4E3B\u63A8\u9996\u9009" : "Popular",
                    items: locale === "zh"
                        ? ["\u54C1\u724C\u5899\u9732\u51FA", "30\u53F0\u00B7\u4E2D\u82F1\u53CC\u8BED", "\u6708\u5EA6\u62A5\u544A+\u6D77\u5916\u63A8\u9001", "\u8BE2\u4EF7\u62A5\u4EF7+\u89C6\u98913\u6761"]
                        : ["Brand wall", "30 CN/EN", "Monthly report", "Quotes + 3 videos"],
                    color: "bg-white/20 ring-2 ring-amber-300",
                    priceColor: "text-amber-200",
                },
                {
                    name: locale === "zh" ? "\uD83D\uDD34 \u65D7\u8230\u7248" : "\uD83D\uDD34 Flagship",
                    price: "\u00A5388",
                    tag: locale === "zh" ? "\u6700\u8D85\u503C" : "Best Value",
                    items: locale === "zh"
                        ? ["\u7B56\u5C55\u54C1\u724C\u6545\u4E8B\u9875", "\u4E0D\u9650\u91CF\u00B7\u4E2D\u82F1\u4FC4", "VR\u770B\u673A+AI\u4F30\u503C", "\u5468\u62A5+\u7ADE\u54C1+\u76F4\u64AD"]
                        : ["Curated story", "Unlimited CN/EN/RU", "VR + AI valuation", "Weekly+benchmark+live"],
                    color: "bg-white/20 ring-2 ring-orange-300",
                    priceColor: "text-orange-200",
                },
            ].map((tier, i) => (<div key={i} className={`rounded-xl p-5 text-center backdrop-blur transition-all hover:scale-105 ${tier.color}`}>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-green-200">{tier.tag}</div>
                <h3 className="mb-1 text-lg font-bold text-white">{tier.name}</h3>
                <div className="mb-3">
                  <span className={`text-3xl font-bold ${tier.priceColor}`}>{tier.price}</span>
                  <span className="text-sm text-green-200">{locale === "zh" ? "/\u5E74" : "/yr"}</span>
                </div>
                <div className="space-y-1.5 text-left">
                  {tier.items.map((item, j) => (<div key={j} className="flex items-start gap-2 text-sm text-green-50">
                      <span className="mt-0.5 text-green-300">▸</span>
                      <span>{item}</span>
                    </div>))}
                </div>
              </div>))}
          </div>
          <div className="mt-6 text-center">
            <p className="text-sm text-green-200">
              {locale === "zh"
                ? "\u5730\u5934\u5C55\u514D\u8D39\u53C2\u5C55 | \u795E\u96D5\u5C55\u514D\u8D39\u7248\u00A50\u5F00\u901A | \u73B0\u573A\u7B7E\u7EA6\u4EAB\u65E9\u9E1F\u6743\u76CA"
                : "Free field expo | Free ShenDiao Expo tier | Early bird at expo"}
            </p>
          </div>
          </div>
        </section>) : (<section className="bg-gradient-to-br from-green-700 via-green-600 to-emerald-700 py-16">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
            <div className="mb-10">
              <h2 className="text-3xl font-bold text-white">
                {locale === "zh" ? "\u795E\u96D5\u5C55\u7FFC \u00B7 \u771F\u5B9E\u4F5C\u4E1A\u9A8C\u8BC1" : "Shendiao WingShow\u2122 \u00B7 Real Operation Verification"}
              </h2>
              <p className="mt-2 text-green-100">
                {locale === "zh"
                ? "\u7530\u95F4\u5B9E\u62CD\u4F5C\u4E1A\u89C6\u9891\uFF0C\u4E3A\u5E73\u53F0\u6BCF\u4E00\u53F0\u5C55\u673A\u63D0\u4F9B\u771F\u5B9E\u5DE5\u51B5\u4F50\u8BC1"
                : "Authentic field-operation footage backing every machine on the platform"}
              </p>
            </div>
            <p className="mx-auto max-w-2xl text-green-50">
              {locale === "zh"
                ? "\u795E\u96D5\u5C55\u7FFC\u2122 \u662F\u795E\u96D5\u519C\u673A\u535A\u89C8\u4F1A\u65D7\u4E0B\u7684\u771F\u5B9E\u4F5C\u4E1A\u89C6\u9891\u9A8C\u8BC1\u6A21\u5757\u3002\u6211\u4EEC\u6DF1\u5165\u7530\u95F4\u5730\u5934\uFF0C\u5B9E\u62CD\u519C\u673A\u771F\u5B9E\u4F5C\u4E1A\u5168\u8FC7\u7A0B\uFF0C\u4E3A\u5168\u7403\u4E70\u5BB6\u63D0\u4F9B\u53EF\u6838\u9A8C\u7684\u8BBE\u5907\u5DE5\u51B5\u8BC1\u636E\u2014\u2014\u4E0D\u6B62\u770B\u53C2\u6570\uFF0C\u66F4\u770B\u5B9E\u6218\u3002"
                : "Shendiao WingShow\u2122 is the field-verification video module of Shendiao Agri-Machinery Expo\u2122. We film real on-field operation to give global buyers verifiable proof of a machine's true working condition \u2014 beyond specs, into the field."}
            </p>
            <div className="mt-8">
              <Link href={`/${locale}/expo/field-videos`} className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-green-700 transition-transform hover:scale-105">
                {locale === "zh" ? "\u89C2\u770B\u771F\u5B9E\u4F5C\u4E1A\u89C6\u9891" : "Watch field operation videos"}
                <ArrowRight className="h-4 w-4"/>
              </Link>
            </div>
          </div>
        </section>)}

      {/* Inquiry Form */}
      <section id="inquiry-form" className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="mb-3 text-3xl font-bold text-gray-900">{t.formTitle}</h2>
          <p className="mb-8 text-gray-600">{t.formSubtitle}</p>
        </div>

        {status === "success" ? (<Card className="border-green-200 bg-green-50">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500"/>
              <p className="text-lg font-medium text-green-800">{t.success}</p>
              <Button variant="outline" onClick={() => setStatus("idle")}>
                {locale === "zh" ? "\u518D\u6B21\u63D0\u4EA4" : "Submit Another"}
              </Button>
            </CardContent>
          </Card>) : (<Card>
            <CardContent className="p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t.fields.company} <span className="text-red-500">*</span>
                    </label>
                    <input type="text" name="company" required value={formData.company} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"/>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t.fields.contact} <span className="text-red-500">*</span>
                    </label>
                    <input type="text" name="contact" required value={formData.contact} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"/>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t.fields.phone} <span className="text-red-500">*</span>
                    </label>
                    <input type="tel" name="phone" required value={formData.phone} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"/>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t.fields.email}
                    </label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"/>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t.fields.country} <span className="text-red-500">*</span>
                    </label>
                    <input type="text" name="country" required value={formData.country} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"/>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t.fields.category}
                    </label>
                    <select name="category" value={formData.category} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200">
                      <option value="">{t.selectPlaceholder}</option>
                      {t.categoryOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t.fields.boothType}
                  </label>
                  <select name="boothType" value={formData.boothType} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200">
                    <option value="">{t.selectPlaceholder}</option>
                    {t.boothOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t.fields.message}
                  </label>
                  <textarea name="message" rows={3} value={formData.message} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"/>
                </div>

                {status === "error" && (<div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {t.error}
                  </div>)}

                <Button type="submit" size="lg" disabled={status === "submitting"} className="w-full bg-red-600 hover:bg-red-700">
                  {status === "submitting" ? (<>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                      {t.submitting}
                    </>) : (<>
                      <Send className="mr-2 h-4 w-4"/>
                      {t.submit}
                    </>)}
                </Button>
              </form>
            </CardContent>
          </Card>)}

        {/* Contact info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Email: 932133255@qq.com
          </p>
        </div>
      </section>
    </div>);
}
