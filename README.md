# shdcam

كاميرا للصور والفيديو بفلاتر الفيلم، والفلتر الافتراضي للصور **Fuji FP100**.
تشتغل كتطبيق ويب (PWA) على أندرويد: تفتح الرابط في Chrome وتضيفها للشاشة الرئيسية وتتصرف مثل أي تطبيق.

**الرابط:** https://shdurazi.github.io/shdcam/

## التثبيت على الجوال

1. افتح الرابط في Chrome.
2. القائمة ⋮ ← «تثبيت التطبيق» (أو «إضافة إلى الشاشة الرئيسية»).
3. اسمح للكاميرا والمايك أول مرة.

بعد التثبيت يشتغل حتى بدون إنترنت.

## المميزات

- معاينة حية والفلتر مطبّق لحظيًا (WebGL2): ألوان الفيلم، توهّج، حبيبات، تظليل الأطراف.
- ٣٦ فلتر في تصنيفات: Film · Fresh · Cine · City · B&W، مع المفضلة ⭐ وزر «بدون فلتر» ⊘.
- تصوير: دقة كاملة عبر `ImageCapture` إذا المتصفح يدعمها، وإلا لقطة من المعاينة. الحفظ JPEG والفلتر مدموج، وتقدر تختار الحجم الأقصى (8192 / 4K / 2.5K / 1.6K) وتضيف ختم التاريخ.
- فيديو: تسجيل بالفلتر المدموج مع صوت المايك (MP4 إذا يدعمه الجهاز، وإلا WebM)، ٧٢٠ أو ١٠٨٠.
- استيراد من المعرض: الصور والفيديوهات تاخذ نفس الفلتر (الفيديو يُعالج بالوقت الحقيقي، مقطع ٣٠ ثانية ياخذ ٣٠ ثانية).
- تحكم: زوم بالقرصة أو أزرار العدسة (1x/2x/3x/5x)، تركيز باللمس، فلاش، مؤقت ٣/١٠ ثواني، شبكة الثلثين، نسب الأبعاد (أصلية / 4:3 / 16:9 / 1:1)، قلب الكاميرا بنقرتين، سحب جانبي لتغيير الفلتر، ضغط مطوّل للمقارنة بالأصل.
- لوحة الضبط «M»: تعديل الصورة وتأثيرات الفيلم، وإعدادات الكاميرا التي يعرضها الجهاز (تعويض التعريض، ISO، توازن الأبيض، التركيز).
- مكتبة داخل التطبيق للمعاينة والحفظ والمشاركة والحذف.

## الخصوصية

كل المعالجة تتم على جهازك. لا رفع للصور، ولا حسابات، ولا تحليلات. المكتبة تنحفظ في تخزين المتصفح (IndexedDB) على جوالك فقط.

## الخط (Thmanyah Sans)

الخط **غير مضمّن** في المستودع لأن ترخيصه يمنع إعادة نشره وتضمينه. تقدر تستخدمه على جوالك: الإعدادات ← الخط ← استيراد، واختر ملفات `.otf` اللي عندك (Regular / Medium / Bold). الملفات تبقى على الجهاز ولا تُرفع لأي مكان. بدون الاستيراد يستخدم التطبيق خط النظام.

## حدود يجب معرفتها

- المتصفح يعطي التطبيق الكاميرا الرئيسية افتراضيًا. العدسة الواسعة (مثل 0.6x) تظهر تلقائيًا إذا كشفها Chrome، وإذا كشف أكثر من كاميرا خلفية تختار بينها من M ← الكاميرا. وأزرار الزوم فوق مدى الجهاز تقصّ الصورة برمجيًا. شاشة M ← الكاميرا تعرض مقاس البث والزوم المدعوم للتشخيص.
- ميزات كاميرا النظام (HDR، الوضع الليلي، RAW، ألوان هاسلبلاد) غير متاحة لتطبيقات الويب.
- الفلاتر تقريب مبني من الصفر لطابع كل فيلم، وليست بيانات رسمية من Fujifilm أو Kodak، والمشروع غير تابع لأي منهما. الأسماء تُستخدم فقط لوصف الطابع.
- بُني واختُبر على Chrome بدون شاشة وكاميرا افتراضية. التجربة الأولى على جهاز حقيقي لم تتم بعد، فأي سلوك غريب يُبلَّغ عنه.

## البناء

```
python3 build.py                        # يكتب index.html و sw.js (GitHub Pages / PWA)
python3 build.py --artifact page.html   # نسخة المحتوى فقط لصفحة Claude Artifact
```

المصدر في `src/` (Python 3 فقط، و Node اختياري لفحص الصياغة). بعد أي تعديل شغّل `build.py` واعمل commit للملفات الناتجة، لأن Pages يقدّم `index.html` مباشرة.
لإعادة توليد الأيقونات: `python3 tools/mkicons.py` (يحتاج Playwright).

## الاعتمادات

- صورة المعاينة التجريبية: «Coffee cup» من بيانات scikit-image، تصوير Rachel Michetti بإذن من Pikolo Espresso Bar، CC0.
- الأيقونات وعلب الفيلم في الواجهة رسوم أصلية للمشروع.

---

# shdcam (English)

A photo + video camera with film looks, **Fuji FP100** as the default photo look. It runs as an installable web app (PWA) on Android.

**Live:** https://shdurazi.github.io/shdcam/

**Install:** open the link in Chrome → ⋮ → *Install app* / *Add to Home screen* → allow camera and microphone.

**Features:** real-time WebGL2 preview (3D LUT, halation, grain, vignette) · 36 looks in Film / Fresh / Cine / City / B&W · full-resolution stills via `ImageCapture` when available · video with the look baked in (MP4 when supported, WebM otherwise) · import photos and videos from the gallery · zoom, tap-to-focus, flash, timer, grid, aspect ratios, manual panel · in-app library · works offline.

**Privacy:** everything is processed on the device; nothing is uploaded and there are no accounts or analytics.

**Font:** Thmanyah Sans is not bundled (its licence forbids redistribution). Import your own copy from Settings → Font; it stays on the device.

**Limits:** web camera access exposes the main camera by default (an ultra-wide button such as 0.6x appears when Chrome exposes it, and other back cameras can be picked under M → Camera); stock-camera features (HDR, night mode, RAW) are unavailable; looks are original approximations, not Fujifilm/Kodak data. Built and tested in headless Chrome with a virtual camera; a first real-device pass is still pending.

**Build:** `python3 build.py` writes `index.html` and `sw.js` from `src/`; commit the output because Pages serves `index.html` directly.

**Credits:** sample image "Coffee cup" from scikit-image's data (CC0, Rachel Michetti, courtesy of Pikolo Espresso Bar). Icons and canister artwork are original.
