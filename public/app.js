"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let adminToken = "";
let lastResult = null;
let guideCategory = "all";
let currentLocale = "en";
const HISTORY_STORAGE_KEY = "scamshield-check-history";
const HISTORY_LIMIT = 10;
const translations = {
  en: {
    pageTitle: "ScamShield — pause, check, protect",
    languageSelectLabel: "Choose language", skipLink: "Skip to content",
    mainNavigation: "Main navigation", navCheck: "Check a message", navGuides: "Safety guides", navSafetyCenter: "Safety tools",
    navReport: "Report a scam", navModerator: "Moderator",
    heroEyebrow: "A calmer way to check", heroLineOne: "That message feels off.", heroLineTwo: "Let's look closer.",
    heroText: "Check a suspicious link or message. See the warning signs, understand what we checked, and choose a safer next step.",
    privacyPill: "Private by default · No account needed", artPause: "pause first", artCheck: "check the details",
    quickCheck: "YOUR QUICK CHECK", checkerHeading: "What would you like to check?", checkLabel: "CHECK",
    tablist: "Choose what to check", tabUrl: "A link", tabMessage: "A message", tabScreenshot: "A screenshot", tabQr: "A QR code",
    urlLabel: "Paste the web address you want to check", urlPlaceholder: "example.com/offer", checkLink: "Check link",
    urlPrivacy: "We never open the link. Don’t paste links containing private tokens or personal details.",
    messageLabel: "Paste the suspicious text", messagePlaceholder: "Paste the message here — remove names, phone numbers, and codes first.",
    messagePrivacy: "Analyzed on this server in memory. Not saved or sent to an outside service.", checkMessage: "Check message",
    screenshotFileLabel: "Upload a screenshot to review", screenshotTextLabel: "Review the text captured from the screenshot",
    screenshotPlaceholder: "Paste the message text you saw in the screenshot, then remove names, phone numbers, and codes first.",
    screenshotPrivacy: "The image preview stays on this device. OCR runs in the browser if the library loads; otherwise you can paste the text manually.",
    checkScreenshot: "Analyze screenshot",
    qrFileLabel: "Upload a QR code image or scan one with your camera", qrTextLabel: "Decoded QR value",
    qrPlaceholder: "A QR code can contain a link, code, or message. Paste or scan the value to review it.",
    qrPrivacy: "The QR read stays on this device. The decoded value is only analyzed after you confirm it.",
    qrCameraButton: "Use camera", checkQr: "Analyze QR value",
    finePrint: "ScamShield is an independent educational tool — not a government service, security guarantee, or replacement for official reporting.",
    howEyebrow: "CLEAR, NOT COMPLICATED", howTitle: "Know what raised a flag.",
    howText: "We show the signals behind a result so you can decide what to do next.",
    howOneTitle: "Check without clicking", howOneText: "Paste a link or message. We inspect the text only; suspicious links are never opened.",
    howTwoTitle: "See the signals", howTwoText: "Understand the specific patterns we spotted — and which checks were unavailable.",
    howThreeTitle: "Choose a safer step", howThreeText: "Get practical next steps. When unsure, verify with a trusted channel you find yourself.",
    guidesEyebrow: "A LITTLE KNOW-HOW GOES FAR", guidesTitle: "Keep these close.",
    guideSearchLabel: "Search safety guides", guideSearchPlaceholder: "Search safety guides", guideFilters: "Filter safety guides",
    guideAll: "All", guideAccount: "Accounts & codes", guidePayments: "Payments & jobs", guideShopping: "Shopping & links",
    helpEyebrow: "ALREADY SENT MONEY OR SHARED A CODE?", helpTitle: "Act quickly. You’re not alone.",
    helpText: "Contact your bank or payment provider using its official app or number, change affected passwords, and preserve the messages.",
    helpLink: "Find official help in your country", reportEyebrow: "HELP OTHERS STAY ALERT", reportTitle: "Report a suspicious incident.",
    reportIntro: "Reports start private and pending. They are never shown publicly unless reviewed.",
    reportPrivacy: "Your report is private. Please leave out OTPs, passwords, and personal identity details.",
    reportCategoryLabel: "What kind of scam?", categoryChoose: "Choose a category", categoryShop: "Fake shop or product",
    categoryJob: "Job or earning offer", categoryPayment: "Payment or delivery request",
    categoryImpersonation: "Someone impersonating an organization", categoryAccount: "Account access or verification",
    categoryOther: "Something else", reportTargetLabel: "Link or account identifier (optional)",
    reportTargetPlaceholder: "example.com — don’t include private tokens", reportSummaryLabel: "What happened?",
    reportSummaryPlaceholder: "Briefly describe the request. Please remove names, phone numbers, and codes.",
    reportSubmit: "Send private report", statusEyebrow: "FOLLOW UP PRIVATELY", statusTitle: "Check your report status",
    statusText: "Enter the private reference you received after reporting.", statusLabel: "Private report reference",
    statusPlaceholder: "Your private reference", statusSubmit: "Check status", moderatorSummary: "Moderator access",
    moderatorIntro: "Restricted to authorized reviewers. Configure SCAMSHIELD_ADMIN_TOKEN on the server before use.",
    moderatorTokenLabel: "Moderator token", moderatorLoad: "Load pending reports",
    footerIntro: "An independent, educational decision-support project. No result guarantees that a link or message is safe.",
    footerCheck: "Check", footerReport: "Report", footerGuides: "Safety tips", footerHelp: "Official help ↗",
    footerDisclaimer: "ScamShield is not affiliated with any government service.",
    checking: "Checking…", sending: "Sending your private report…",
    reportSuccess: "Report received and pending review. Save this private reference to check status:",
    statusLoading: "Looking up your report…", statusResult: "Report status:", lastUpdated: "Last updated",
    queueEmpty: "No reports are waiting for review.", target: "Target:",
    pendingCount: "pending report(s).", promptReason: "Add a short reason for marking this report",
    riskHigh: "High risk indicators", riskCaution: "Pause and verify", riskUnknown: "Unable to determine",
    riskNoKnown: "No known threat found", riskKnown: "Known malicious match", resultUnknown:
      "We could not make a reliable call from the checks currently available.",
    resultRisk: "This is a risk signal, not proof that a person or organization is a scammer.",
    resultEvidence: "What we noticed", resultNoEvidence: "No strong local-rule signal was found.",
    resultLinks: "Links found (not opened):", resultNext: "A safer next step",
    resultCoverage: "Local text rules: complete · Live threat-list check: not configured",
    resultDisclaimer: "A result cannot guarantee that something is safe.",
    guidesNoMatch: "No guides match that search. Try another word or category.",
    statusPending: "pending review", statusVerified: "verified", statusRejected: "rejected", statusEscalated: "escalated",
    errorCategory: "Choose a listed report category.", errorSummary: "Add a little more detail (at least 12 characters).",
    errorReportNotFound: "No report was found for that reference.", errorNetwork: "The app could not reach the server. Check your connection and try again.",
    strengthWeak: "weak signal", strengthMedium: "moderate signal", strengthStrong: "strong signal",
    categoryNames: {
      all: "All", account: "Accounts & codes", payments: "Payments & jobs", shopping: "Shopping & links",
    },
    historyEyebrow: "PRIVATE TO THIS BROWSER", historyTitle: "Recent checks",
    historyPrivacy: "Saved on this device only. Original links and messages are not saved. Clear this history any time.",
    historyLanguageNote: "Saved result details stay in the language used when checked.",
    historyClear: "Clear history", historyEmpty: "No checks saved yet.",
    historyTypeUrl: "Link check", historyTypeMessage: "Message check", historyStorageError: "Browser storage is unavailable, so this check could not be saved.",
    historyCleared: "Your local check history has been cleared.",
    safetyCenterEyebrow: "PRACTICAL SAFETY TOOLS", safetyCenterTitle: "Get help and build safer habits.",
    responseEyebrow: "IF SOMETHING HAPPENED", responseTitle: "What should I do now?",
    responseScenarioLabel: "Choose what happened", responseScenarioCode: "I shared a one-time code or password",
    responseScenarioPayment: "I sent money or paid a fee", responseScenarioDevice: "I installed an app or gave device access",
    responseScenarioLink: "I opened a link or entered account details",
    countryHelpEyebrow: "OFFICIAL SUPPORT", countryHelpTitle: "Find help in your country", countrySelectLabel: "Choose a country",
    countryHelpNote: "These links go to official reporting or cyber-safety services. Availability and remit vary. For urgent financial loss, contact your bank using a trusted number.",
    countryUS: "United States", countryCanada: "Canada", countryIndia: "India", countryFrance: "France",
    countryLinkReport: "Report or get official guidance", countryOrgFtc: "Federal Trade Commission — ReportFraud", countryOrgCafc: "Canadian Anti-Fraud Centre", countryOrgIndia: "National Cyber Crime Reporting Portal", countryOrgFrance: "Cybermalveillance.gouv.fr",
    quizEyebrow: "PRACTICE SPOTTING SCAMS", quizTitle: "Quick safety quiz",
    quizIntro: "Try three short scenarios. Your answers stay in this browser session.",
    quizStart: "Start quiz", quizNext: "Next question", quizFinish: "See my result", quizAgain: "Try again",
    quizQuestion: "Question", quizCorrect: "Good choice.", quizIncorrect: "Not the safest choice.",
    quizScore: "You got {score} of {total} right. Keep using official channels and never share one-time codes.",
    plannerScenarios: {
      code: { label: "I shared a one-time code or password", steps: ["Contact the service or bank immediately using its official app or a number you already trust; ask them to secure the account.", "Change the affected password from the official site or app. Sign out other sessions and turn on multi-factor authentication if available.", "Tell your mobile provider if your phone service suddenly stops. Save relevant messages and do not share any more codes."] },
      payment: { label: "I sent money or paid a fee", steps: ["Call your bank or payment provider immediately using the number on your card or its official app. Ask whether the payment can be stopped or disputed.", "Save receipts, account names, messages, and transaction references. Report the incident through the official service for your country.", "Stop sending money, including extra fees to recover funds. Recovery offers that demand upfront payment are often another scam."] },
      device: { label: "I installed an app or gave device access", steps: ["Disconnect the device from the internet if someone is controlling it. Do not use it to sign in to banking or email.", "From a different trusted device, contact your bank, change important passwords, and revoke unknown sessions or access.", "Ask a trusted technician or official support service to check the device. Keep messages and app details as evidence."] },
      link: { label: "I opened a link or entered account details", steps: ["If you only opened the page, close it and do not download files or enter more information.", "If you entered a password, change it through the official app or site from a trusted device and secure any reused accounts.", "If you shared payment or identity details, contact the relevant bank or provider and follow your country's official reporting guidance."] },
    },
  },
  bn: {
    pageTitle: "ScamShield — থামুন, যাচাই করুন, সুরক্ষিত থাকুন",
    languageSelectLabel: "ভাষা বেছে নিন", skipLink: "মূল বিষয়বস্তুতে যান",
    mainNavigation: "প্রধান নেভিগেশন", navCheck: "বার্তা যাচাই", navGuides: "নিরাপত্তা নির্দেশিকা",
    navReport: "প্রতারণার তথ্য দিন", navModerator: "পর্যালোচক",
    heroEyebrow: "শান্তভাবে যাচাই করুন", heroLineOne: "বার্তাটি কি সন্দেহজনক?", heroLineTwo: "চলুন ভালো করে দেখি।",
    heroText: "সন্দেহজনক লিংক বা বার্তা পরীক্ষা করুন। সতর্কতার সংকেত বুঝুন, কী যাচাই হয়েছে দেখুন এবং নিরাপদ পরবর্তী পদক্ষেপ নিন।",
    privacyPill: "গোপনীয়তা আগে · অ্যাকাউন্ট লাগবে না", artPause: "আগে থামুন", artCheck: "বিস্তারিত যাচাই",
    quickCheck: "দ্রুত যাচাই", checkerHeading: "আপনি কী যাচাই করতে চান?", checkLabel: "যাচাই",
    tablist: "যাচাইয়ের ধরন বেছে নিন", tabUrl: "লিংক", tabMessage: "বার্তা",
    urlLabel: "যে ওয়েব ঠিকানাটি যাচাই করতে চান পেস্ট করুন", urlPlaceholder: "example.com/offer", checkLink: "লিংক যাচাই",
    urlPrivacy: "আমরা লিংকটি খুলি না। ব্যক্তিগত টোকেন বা তথ্যসহ লিংক পেস্ট করবেন না।",
    messageLabel: "সন্দেহজনক লেখাটি পেস্ট করুন", messagePlaceholder: "বার্তাটি পেস্ট করুন — আগে নাম, ফোন নম্বর ও কোড মুছে দিন।",
    messagePrivacy: "এই সার্ভারে মেমোরিতে বিশ্লেষণ হয়। সংরক্ষণ বা বাইরের সেবায় পাঠানো হয় না।", checkMessage: "বার্তা যাচাই",
    finePrint: "ScamShield একটি স্বতন্ত্র শিক্ষামূলক টুল — সরকারি সেবা বা নিরাপত্তার নিশ্চয়তা নয় এবং অফিসিয়াল রিপোর্টিংয়ের বিকল্পও নয়।",
    howEyebrow: "সহজ ও স্পষ্ট", howTitle: "কোন বিষয়টি সতর্ক করেছে জানুন।",
    howText: "ফলাফলের পেছনের সংকেতগুলো দেখুন, তারপর পরবর্তী পদক্ষেপ ঠিক করুন।",
    howOneTitle: "ক্লিক না করেই যাচাই", howOneText: "লিংক বা বার্তা পেস্ট করুন। আমরা শুধু লেখা দেখি; সন্দেহজনক লিংক খুলি না।",
    howTwoTitle: "সংকেতগুলো দেখুন", howTwoText: "কোন ধরনগুলো চোখে পড়েছে এবং কোন যাচাই করা যায়নি তা জানুন।",
    howThreeTitle: "নিরাপদ পদক্ষেপ নিন", howThreeText: "করণীয় জেনে নিন। সন্দেহ থাকলে নিজে খুঁজে পাওয়া বিশ্বস্ত মাধ্যমে যাচাই করুন।",
    guidesEyebrow: "কয়েকটি নিয়ম আপনাকে সুরক্ষিত রাখে", guidesTitle: "মনে রাখার মতো পরামর্শ",
    guideSearchLabel: "নিরাপত্তা নির্দেশিকা খুঁজুন", guideSearchPlaceholder: "নিরাপত্তা নির্দেশিকা খুঁজুন", guideFilters: "নিরাপত্তা নির্দেশিকা বাছাই",
    guideAll: "সব", guideAccount: "অ্যাকাউন্ট ও কোড", guidePayments: "পেমেন্ট ও চাকরি", guideShopping: "কেনাকাটা ও লিংক",
    helpEyebrow: "টাকা পাঠিয়েছেন বা কোড দিয়েছেন?", helpTitle: "দ্রুত পদক্ষেপ নিন। সহায়তা পাবেন।",
    helpText: "ব্যাংক বা পেমেন্ট সেবার অফিসিয়াল অ্যাপ/নম্বরে যোগাযোগ করুন, আক্রান্ত পাসওয়ার্ড বদলান এবং বার্তাগুলো সংরক্ষণ করুন।",
    helpLink: "BGD e-GOV CIRT দেখুন", reportEyebrow: "অন্যদের সতর্ক থাকতে সাহায্য করুন",
    reportTitle: "সন্দেহজনক ঘটনার তথ্য দিন।", reportIntro: "রিপোর্ট প্রথমে গোপন ও পর্যালোচনার অপেক্ষায় থাকে। যাচাই ছাড়া প্রকাশ করা হয় না।",
    reportPrivacy: "আপনার রিপোর্ট গোপন। ওটিপি, পাসওয়ার্ড বা পরিচয়সংক্রান্ত ব্যক্তিগত তথ্য দেবেন না।",
    reportCategoryLabel: "কী ধরনের প্রতারণা?", categoryChoose: "ধরন বেছে নিন", categoryShop: "ভুয়া দোকান বা পণ্য",
    categoryJob: "চাকরি বা আয়ের প্রস্তাব", categoryPayment: "পেমেন্ট বা ডেলিভারির অনুরোধ",
    categoryImpersonation: "প্রতিষ্ঠানের ছদ্মবেশ", categoryAccount: "অ্যাকাউন্ট বা যাচাইকরণ",
    categoryOther: "অন্য কিছু", reportTargetLabel: "লিংক বা অ্যাকাউন্ট শনাক্তকারী (ঐচ্ছিক)",
    reportTargetPlaceholder: "example.com — ব্যক্তিগত টোকেন দেবেন না", reportSummaryLabel: "কী ঘটেছে?",
    reportSummaryPlaceholder: "অনুরোধটি সংক্ষেপে লিখুন। নাম, ফোন নম্বর ও কোড মুছে দিন।",
    reportSubmit: "গোপন রিপোর্ট পাঠান", statusEyebrow: "গোপনে অগ্রগতি জানুন", statusTitle: "রিপোর্টের অবস্থা দেখুন",
    statusText: "রিপোর্টের পরে পাওয়া গোপন রেফারেন্সটি লিখুন।", statusLabel: "গোপন রিপোর্ট রেফারেন্স",
    statusPlaceholder: "আপনার গোপন রেফারেন্স", statusSubmit: "অবস্থা দেখুন", moderatorSummary: "পর্যালোচকের প্রবেশ",
    moderatorIntro: "শুধু অনুমোদিত পর্যালোচকদের জন্য। ব্যবহারের আগে সার্ভারে SCAMSHIELD_ADMIN_TOKEN সেট করুন।",
    moderatorTokenLabel: "পর্যালোচক টোকেন", moderatorLoad: "অপেক্ষমাণ রিপোর্ট দেখুন",
    footerIntro: "স্বতন্ত্র শিক্ষামূলক সিদ্ধান্ত-সহায়ক প্রকল্প। কোনো ফলাফলই লিংক বা বার্তা নিরাপদ হওয়ার নিশ্চয়তা দেয় না।",
    footerCheck: "যাচাই", footerReport: "রিপোর্ট", footerGuides: "নিরাপত্তা পরামর্শ", footerHelp: "অফিসিয়াল সহায়তা ↗",
    footerDisclaimer: "ScamShield কোনো সরকারি সেবার সঙ্গে যুক্ত নয়।",
    checking: "যাচাই হচ্ছে…", sending: "গোপন রিপোর্ট পাঠানো হচ্ছে…",
    reportSuccess: "রিপোর্ট গৃহীত হয়েছে এবং পর্যালোচনার অপেক্ষায়। অবস্থা দেখার জন্য এই গোপন রেফারেন্সটি রাখুন:",
    statusLoading: "রিপোর্ট খোঁজা হচ্ছে…", statusResult: "রিপোর্টের অবস্থা:", lastUpdated: "সর্বশেষ হালনাগাদ",
    queueEmpty: "পর্যালোচনার অপেক্ষায় কোনো রিপোর্ট নেই।", target: "লক্ষ্য:",
    pendingCount: "টি অপেক্ষমাণ রিপোর্ট।", promptReason: "এই রিপোর্টটি চিহ্নিত করার সংক্ষিপ্ত কারণ লিখুন:",
    riskHigh: "উচ্চ ঝুঁকির সংকেত", riskCaution: "থামুন এবং যাচাই করুন", riskUnknown: "নিশ্চিত হওয়া যায়নি",
    riskNoKnown: "পরিচিত হুমকি মেলেনি", riskKnown: "ক্ষতিকর হিসেবে তালিকাভুক্ত",
    resultUnknown: "উপলভ্য যাচাই দিয়ে নির্ভরযোগ্য সিদ্ধান্তে পৌঁছানো যায়নি।",
    resultRisk: "এটি ঝুঁকির সংকেত, কোনো ব্যক্তি বা প্রতিষ্ঠান প্রতারক—তার প্রমাণ নয়।",
    resultEvidence: "যা চোখে পড়েছে", resultNoEvidence: "স্থানীয় নিয়মে জোরালো সংকেত পাওয়া যায়নি।",
    resultLinks: "যে লিংকগুলো পাওয়া গেছে (খোলা হয়নি):", resultNext: "নিরাপদ পরবর্তী পদক্ষেপ",
    resultCoverage: "স্থানীয় নিয়ম: সম্পন্ন · লাইভ হুমকি-তালিকা যাচাই: চালু নেই",
    resultDisclaimer: "কোনো ফলাফলই নিরাপদ হওয়ার নিশ্চয়তা দিতে পারে না।",
    guidesNoMatch: "এই খোঁজে কোনো নির্দেশিকা মেলেনি। অন্য শব্দ বা ধরন দিয়ে খুঁজুন।",
    statusPending: "পর্যালোচনার অপেক্ষায়", statusVerified: "যাচাইকৃত", statusRejected: "গ্রহণ করা হয়নি", statusEscalated: "এগিয়ে পাঠানো হয়েছে",
    errorCategory: "রিপোর্টের তালিকাভুক্ত ধরন বেছে নিন।", errorSummary: "আরও একটু বিস্তারিত লিখুন (অন্তত ১২ অক্ষর)।",
    errorReportNotFound: "এই রেফারেন্সে কোনো রিপোর্ট পাওয়া যায়নি।", errorNetwork: "সার্ভারের সঙ্গে সংযোগ করা যায়নি। সংযোগ দেখে আবার চেষ্টা করুন।",
    strengthWeak: "দুর্বল সংকেত", strengthMedium: "মাঝারি সংকেত", strengthStrong: "জোরালো সংকেত",
    categoryNames: { all: "সব", account: "অ্যাকাউন্ট ও কোড", payments: "পেমেন্ট ও চাকরি", shopping: "কেনাকাটা ও লিংক" },
  },
  es: {
    pageTitle: "ScamShield — pausa, comprueba, protégete",
    languageSelectLabel: "Elegir idioma", skipLink: "Ir al contenido",
    mainNavigation: "Navegación principal", navCheck: "Comprobar un mensaje", navGuides: "Guías de seguridad", navSafetyCenter: "Herramientas de seguridad", navReport: "Denunciar una estafa", navModerator: "Moderación",
    heroEyebrow: "Comprueba con calma", heroLineOne: "¿Ese mensaje te parece raro?", heroLineTwo: "Vamos a revisarlo.",
    heroText: "Comprueba un enlace o mensaje sospechoso. Consulta las señales, entiende qué verificamos y elige un siguiente paso más seguro.",
    privacyPill: "Privacidad primero · Sin cuenta", artPause: "detente primero", artCheck: "revisa los detalles",
    quickCheck: "COMPROBACIÓN RÁPIDA", checkerHeading: "¿Qué quieres comprobar?", checkLabel: "COMPROBAR",
    tablist: "Elige qué quieres comprobar", tabUrl: "Un enlace", tabMessage: "Un mensaje",
    urlLabel: "Pega la dirección web que quieres comprobar", urlPlaceholder: "ejemplo.com/oferta", checkLink: "Comprobar enlace",
    urlPrivacy: "Nunca abrimos el enlace. No pegues enlaces con datos personales o tokens privados.",
    messageLabel: "Pega el texto sospechoso", messagePlaceholder: "Pega el mensaje aquí; elimina antes nombres, teléfonos y códigos.",
    messagePrivacy: "Se analiza en memoria en este servidor. No se guarda ni se envía a otros servicios.", checkMessage: "Comprobar mensaje",
    finePrint: "ScamShield es una herramienta educativa independiente; no es un servicio gubernamental ni una garantía de seguridad.",
    howEyebrow: "CLARO Y SENCILLO", howTitle: "Entiende qué señales aparecieron.",
    howText: "Mostramos las señales para que puedas decidir qué hacer después.",
    howOneTitle: "Comprueba sin hacer clic", howOneText: "Pega un enlace o mensaje. Solo analizamos el texto; nunca abrimos enlaces sospechosos.",
    howTwoTitle: "Mira las señales", howTwoText: "Descubre qué patrones detectamos y qué comprobaciones no estaban disponibles.",
    howThreeTitle: "Elige un paso seguro", howThreeText: "Recibe consejos prácticos. Si tienes dudas, verifica por un canal oficial que busques tú.",
    guidesEyebrow: "CONSEJOS PRÁCTICOS", guidesTitle: "Tenlos a mano.",
    guideSearchLabel: "Buscar guías de seguridad", guideSearchPlaceholder: "Buscar guías de seguridad", guideFilters: "Filtrar guías de seguridad",
    guideAll: "Todas", guideAccount: "Cuentas y códigos", guidePayments: "Pagos y empleos", guideShopping: "Compras y enlaces",
    helpEyebrow: "¿YA ENVIASTE DINERO O COMPARTISTE UN CÓDIGO?", helpTitle: "Actúa pronto. Hay ayuda.",
    helpText: "Contacta con tu banco o proveedor de pagos mediante su aplicación o número oficial, cambia las contraseñas afectadas y guarda los mensajes.",
    helpLink: "Encuentra ayuda oficial en tu país", reportEyebrow: "AYUDA A PROTEGER A OTRAS PERSONAS",
    reportTitle: "Informa de un incidente sospechoso.", reportIntro: "Los informes son privados y quedan pendientes. No se publican sin revisión.",
    reportPrivacy: "Tu informe es privado. No incluyas OTP, contraseñas ni datos de identidad.",
    reportCategoryLabel: "¿Qué tipo de estafa?", categoryChoose: "Elige una categoría", categoryShop: "Tienda o producto falso",
    categoryJob: "Oferta de empleo o ingresos", categoryPayment: "Pago o entrega", categoryImpersonation: "Suplantación de una organización",
    categoryAccount: "Acceso o verificación de cuenta", categoryOther: "Otro", reportTargetLabel: "Enlace o identificador (opcional)",
    reportTargetPlaceholder: "ejemplo.com; no incluyas tokens privados", reportSummaryLabel: "¿Qué ocurrió?",
    reportSummaryPlaceholder: "Describe brevemente la solicitud. Elimina nombres, teléfonos y códigos.",
    reportSubmit: "Enviar informe privado", statusEyebrow: "CONSULTA EN PRIVADO", statusTitle: "Consulta el estado del informe",
    statusText: "Introduce la referencia privada que recibiste.", statusLabel: "Referencia privada del informe",
    statusPlaceholder: "Tu referencia privada", statusSubmit: "Consultar estado", moderatorSummary: "Acceso de moderación",
    moderatorIntro: "Solo para revisores autorizados. Configura SCAMSHIELD_ADMIN_TOKEN en el servidor.",
    moderatorTokenLabel: "Token de moderación", moderatorLoad: "Cargar informes pendientes",
    footerIntro: "Proyecto educativo independiente para ayudar a decidir. Ningún resultado garantiza que un enlace o mensaje sea seguro.",
    footerCheck: "Comprobar", footerReport: "Informar", footerGuides: "Consejos", footerHelp: "Ayuda oficial ↗",
    footerDisclaimer: "ScamShield no está afiliado a ningún servicio gubernamental.",
    checking: "Comprobando…", sending: "Enviando el informe privado…",
    reportSuccess: "Informe recibido y pendiente de revisión. Guarda esta referencia privada para consultar su estado:",
    statusLoading: "Buscando el informe…", statusResult: "Estado del informe:", lastUpdated: "Última actualización",
    queueEmpty: "No hay informes pendientes.", target: "Objetivo:", pendingCount: "informe(s) pendiente(s).",
    promptReason: "Añade un motivo breve para marcar este informe",
    riskHigh: "Indicios de riesgo alto", riskCaution: "Detente y verifica", riskUnknown: "No se pudo determinar",
    riskNoKnown: "No se encontraron amenazas conocidas", riskKnown: "Coincidencia con amenaza conocida",
    resultUnknown: "No podemos llegar a una conclusión fiable con las comprobaciones disponibles.",
    resultRisk: "Es una señal de riesgo, no una prueba de que una persona u organización sea fraudulenta.",
    resultEvidence: "Lo que observamos", resultNoEvidence: "Las reglas locales no detectaron indicios claros.",
    resultLinks: "Enlaces encontrados (no abiertos):", resultNext: "Siguiente paso más seguro",
    resultCoverage: "Reglas locales: completas · Consulta de amenazas en línea: no configurada",
    resultDisclaimer: "Ningún resultado puede garantizar que algo sea seguro.",
    guidesNoMatch: "No hay guías que coincidan. Prueba con otra palabra o categoría.",
    strengthWeak: "indicio débil", strengthMedium: "indicio moderado", strengthStrong: "indicio fuerte",
    categoryNames: {all:"Todas",account:"Cuentas y códigos",payments:"Pagos y empleos",shopping:"Compras y enlaces"},
    historyEyebrow: "PRIVADO EN ESTE NAVEGADOR", historyTitle: "Comprobaciones recientes",
    historyPrivacy: "Solo se guarda en este dispositivo. No se guardan los enlaces ni mensajes originales. Puedes borrar el historial cuando quieras.",
    historyLanguageNote: "Los detalles guardados conservan el idioma usado al hacer la comprobación.",
    historyClear: "Borrar historial", historyEmpty: "Aún no hay comprobaciones guardadas.",
    historyTypeUrl: "Comprobación de enlace", historyTypeMessage: "Comprobación de mensaje", historyStorageError: "El almacenamiento del navegador no está disponible; no se pudo guardar esta comprobación.",
    historyCleared: "Se borró el historial local.",
    safetyCenterEyebrow: "HERRAMIENTAS PRÁCTICAS", safetyCenterTitle: "Obtén ayuda y aprende a protegerte.",
    responseEyebrow: "SI YA OCURRIÓ ALGO", responseTitle: "¿Qué debería hacer ahora?",
    responseScenarioLabel: "Elige lo que ocurrió", responseScenarioCode: "Compartí un código de un solo uso o una contraseña",
    responseScenarioPayment: "Envié dinero o pagué una tarifa", responseScenarioDevice: "Instalé una aplicación o di acceso al dispositivo",
    responseScenarioLink: "Abrí un enlace o introduje datos de mi cuenta",
    countryHelpEyebrow: "AYUDA OFICIAL", countryHelpTitle: "Encuentra ayuda en tu país", countrySelectLabel: "Elige un país",
    countryHelpNote: "Estos enlaces llevan a servicios oficiales de denuncia o ciberseguridad. Su disponibilidad y competencia varían. Si hay una pérdida económica urgente, contacta con tu banco mediante un número de confianza.",
    countryUS: "Estados Unidos", countryCanada: "Canadá", countryIndia: "India", countryFrance: "Francia",
    countryLinkReport: "Denunciar u obtener orientación oficial", countryOrgFtc: "Comisión Federal de Comercio — ReportFraud", countryOrgCafc: "Centro Canadiense Antifraude", countryOrgIndia: "Portal Nacional de Denuncias de Ciberdelitos", countryOrgFrance: "Cybermalveillance.gouv.fr",
    quizEyebrow: "PRACTICA CÓMO DETECTAR ESTAFAS", quizTitle: "Cuestionario rápido de seguridad",
    quizIntro: "Prueba tres situaciones breves. Tus respuestas permanecen en esta sesión del navegador.",
    quizStart: "Empezar", quizNext: "Siguiente pregunta", quizFinish: "Ver resultado", quizAgain: "Intentarlo de nuevo",
    quizQuestion: "Pregunta", quizCorrect: "Buena elección.", quizIncorrect: "No es la opción más segura.",
    quizScore: "Has acertado {score} de {total}. Usa canales oficiales y nunca compartas códigos de un solo uso.",
    plannerScenarios: {
      code: { label: "Compartí un código de un solo uso o una contraseña", steps: ["Contacta de inmediato con el servicio o banco mediante su aplicación oficial o un número de confianza; pide que protejan la cuenta.", "Cambia la contraseña desde el sitio o aplicación oficial. Cierra otras sesiones y activa la autenticación multifactor si está disponible.", "Contacta con tu operador si el teléfono deja de tener servicio de repente. Guarda los mensajes y no compartas más códigos."] },
      payment: { label: "Envié dinero o pagué una tarifa", steps: ["Llama de inmediato a tu banco o proveedor de pagos con el número de tu tarjeta o su aplicación oficial. Pregunta si se puede detener o reclamar el pago.", "Guarda recibos, nombres de cuentas, mensajes y referencias de transacción. Denuncia el incidente mediante el servicio oficial de tu país.", "No envíes más dinero, tampoco para recuperar fondos. Las ofertas de recuperación que exigen pagos por adelantado suelen ser otra estafa."] },
      device: { label: "Instalé una aplicación o di acceso al dispositivo", steps: ["Desconecta el dispositivo de internet si alguien lo está controlando. No lo uses para acceder a tu banco o correo.", "Desde otro dispositivo de confianza, contacta con tu banco, cambia contraseñas importantes y revoca sesiones o accesos desconocidos.", "Pide a un técnico de confianza o servicio oficial que revise el dispositivo. Guarda los mensajes y datos de la aplicación como pruebas."] },
      link: { label: "Abrí un enlace o introduje datos de mi cuenta", steps: ["Si solo abriste la página, ciérrala y no descargues archivos ni introduzcas más datos.", "Si escribiste una contraseña, cámbiala desde la aplicación o sitio oficial usando un dispositivo de confianza y protege las cuentas donde la reutilizaste.", "Si compartiste datos de pago o identidad, contacta con el banco o proveedor correspondiente y sigue las pautas oficiales de denuncia de tu país."] },
    },
    statusPending: "pendiente de revisión", statusVerified: "verificado", statusRejected: "rechazado", statusEscalated: "derivado",
    errorCategory: "Elige una categoría de informe.", errorSummary: "Añade más detalles (al menos 12 caracteres).",
    errorReportNotFound: "No se encontró ningún informe con esa referencia.", errorNetwork: "No se pudo conectar con el servidor. Comprueba tu conexión.",
  },
  fr: {
    pageTitle: "ScamShield — faites une pause, vérifiez, protégez-vous",
    languageSelectLabel: "Choisir la langue", skipLink: "Aller au contenu",
    mainNavigation: "Navigation principale", navCheck: "Vérifier un message", navGuides: "Conseils de sécurité", navSafetyCenter: "Outils de sécurité", navReport: "Signaler une arnaque", navModerator: "Modération",
    heroEyebrow: "Vérifiez en toute sérénité", heroLineOne: "Ce message vous semble étrange ?", heroLineTwo: "Examinons-le ensemble.",
    heroText: "Vérifiez un lien ou un message suspect. Consultez les signaux, comprenez nos vérifications et choisissez une prochaine étape plus sûre.",
    privacyPill: "Confidentialité d'abord · Sans compte", artPause: "faites une pause", artCheck: "vérifiez les détails",
    quickCheck: "VÉRIFICATION RAPIDE", checkerHeading: "Que souhaitez-vous vérifier ?", checkLabel: "VÉRIFIER",
    tablist: "Choisissez ce que vous voulez vérifier", tabUrl: "Un lien", tabMessage: "Un message", tabScreenshot: "Une capture d'écran", tabQr: "Un QR code",
    urlLabel: "Collez l'adresse web à vérifier", urlPlaceholder: "exemple.fr/offre", checkLink: "Vérifier le lien",
    urlPrivacy: "Nous n'ouvrons jamais le lien. Ne collez pas d'adresse contenant des données personnelles ou des jetons privés.",
    messageLabel: "Collez le texte suspect", messagePlaceholder: "Collez le message ici ; supprimez d'abord noms, numéros et codes.",
    messagePrivacy: "Analyse en mémoire sur ce serveur. Aucune sauvegarde ni transmission à un service externe.", checkMessage: "Vérifier le message",
    screenshotFileLabel: "Téléversez une capture pour la vérifier", screenshotTextLabel: "Vérifiez le texte extrait de la capture",
    screenshotPlaceholder: "Collez le texte du message visible sur la capture, puis supprimez noms, numéros et codes.",
    screenshotPrivacy: "L'aperçu reste sur cet appareil. L'OCR s'exécute dans le navigateur si la bibliothèque est disponible ; sinon, vous pouvez coller le texte manuellement.",
    checkScreenshot: "Analyser la capture",
    qrFileLabel: "Téléversez une image QR ou scannez-en une avec votre appareil photo", qrTextLabel: "Valeur QR décodée",
    qrPlaceholder: "Un QR code peut contenir un lien, un code ou un message. Collez ou scannez la valeur pour la vérifier.",
    qrPrivacy: "La lecture du QR reste sur cet appareil. La valeur décodée n'est analysée qu'après validation.",
    qrCameraButton: "Utiliser la caméra", checkQr: "Analyser la valeur QR",
    finePrint: "ScamShield est un outil éducatif indépendant, ni un service public ni une garantie de sécurité.",
    howEyebrow: "CLAIR ET SIMPLE", howTitle: "Comprenez les signaux détectés.",
    howText: "Nous expliquons les signaux pour vous aider à décider de la suite.",
    howOneTitle: "Vérifiez sans cliquer", howOneText: "Collez un lien ou un message. Nous analysons le texte sans ouvrir les liens suspects.",
    howTwoTitle: "Consultez les signaux", howTwoText: "Découvrez les schémas repérés et les vérifications indisponibles.",
    howThreeTitle: "Choisissez une étape sûre", howThreeText: "Recevez des conseils pratiques. En cas de doute, vérifiez via un canal officiel que vous trouvez vous-même.",
    guidesEyebrow: "CONSEILS PRATIQUES", guidesTitle: "À garder en tête.",
    guideSearchLabel: "Rechercher des conseils de sécurité", guideSearchPlaceholder: "Rechercher des conseils", guideFilters: "Filtrer les conseils de sécurité",
    guideAll: "Tous", guideAccount: "Comptes et codes", guidePayments: "Paiements et emplois", guideShopping: "Achats et liens",
    helpEyebrow: "VOUS AVEZ ENVOYÉ DE L'ARGENT OU UN CODE ?", helpTitle: "Agissez vite. Vous pouvez être aidé.",
    helpText: "Contactez votre banque ou service de paiement via son application ou numéro officiel, changez les mots de passe concernés et conservez les messages.",
    helpLink: "Trouver une aide officielle dans votre pays", reportEyebrow: "AIDEZ À PROTÉGER LES AUTRES",
    reportTitle: "Signaler un incident suspect.", reportIntro: "Les signalements restent privés et en attente. Ils ne sont pas publiés sans examen.",
    reportPrivacy: "Votre signalement est privé. N'incluez ni OTP, ni mot de passe, ni identité personnelle.",
    reportCategoryLabel: "Quel type d'arnaque ?", categoryChoose: "Choisir une catégorie", categoryShop: "Fausse boutique ou produit",
    categoryJob: "Offre d'emploi ou de revenus", categoryPayment: "Paiement ou livraison", categoryImpersonation: "Usurpation d'une organisation",
    categoryAccount: "Accès ou vérification de compte", categoryOther: "Autre", reportTargetLabel: "Lien ou identifiant (facultatif)",
    reportTargetPlaceholder: "exemple.fr ; ne mettez pas de jeton privé", reportSummaryLabel: "Que s'est-il passé ?",
    reportSummaryPlaceholder: "Décrivez brièvement la demande. Supprimez noms, numéros et codes.",
    reportSubmit: "Envoyer un signalement privé", statusEyebrow: "SUIVI PRIVÉ", statusTitle: "Consulter le statut du signalement",
    statusText: "Saisissez la référence privée reçue après le signalement.", statusLabel: "Référence privée",
    statusPlaceholder: "Votre référence privée", statusSubmit: "Vérifier le statut", moderatorSummary: "Accès modérateur",
    moderatorIntro: "Réservé aux personnes autorisées. Configurez SCAMSHIELD_ADMIN_TOKEN sur le serveur.",
    moderatorTokenLabel: "Jeton modérateur", moderatorLoad: "Charger les signalements",
    footerIntro: "Projet éducatif indépendant d'aide à la décision. Aucun résultat ne garantit qu'un lien ou message est sûr.",
    footerCheck: "Vérifier", footerReport: "Signaler", footerGuides: "Conseils", footerHelp: "Aide officielle ↗",
    footerDisclaimer: "ScamShield n'est affilié à aucun service gouvernemental.",
    checking: "Vérification…", sending: "Envoi du signalement privé…",
    reportSuccess: "Signalement reçu, en attente d'examen. Conservez cette référence privée pour suivre son statut :",
    statusLoading: "Recherche du signalement…", statusResult: "Statut :", lastUpdated: "Dernière mise à jour",
    queueEmpty: "Aucun signalement en attente.", target: "Cible :", pendingCount: "signalement(s) en attente.",
    promptReason: "Ajoutez un bref motif pour marquer ce signalement",
    riskHigh: "Indices de risque élevé", riskCaution: "Faites une pause et vérifiez", riskUnknown: "Impossible à déterminer",
    riskNoKnown: "Aucune menace connue trouvée", riskKnown: "Correspondance avec une menace connue",
    resultUnknown: "Les vérifications disponibles ne permettent pas de conclure de façon fiable.",
    resultRisk: "C'est un signal de risque, pas la preuve qu'une personne ou organisation est frauduleuse.",
    resultEvidence: "Ce que nous avons observé", resultNoEvidence: "Les règles locales n'ont détecté aucun indice fort.",
    resultLinks: "Liens détectés (non ouverts) :", resultNext: "Prochaine étape plus sûre",
    resultCoverage: "Règles locales : terminées · Vérification en ligne des menaces : non configurée",
    resultDisclaimer: "Aucun résultat ne peut garantir qu'un élément est sûr.",
    guidesNoMatch: "Aucun conseil ne correspond. Essayez un autre mot ou filtre.",
    strengthWeak: "indice faible", strengthMedium: "indice modéré", strengthStrong: "indice fort",
    categoryNames: {all:"Tous",account:"Comptes et codes",payments:"Paiements et emplois",shopping:"Achats et liens"},
    historyEyebrow: "PRIVÉ À CE NAVIGATEUR", historyTitle: "Vérifications récentes",
    historyPrivacy: "Enregistré uniquement sur cet appareil. Les liens et messages d'origine ne sont pas conservés. Vous pouvez tout effacer à tout moment.",
    historyLanguageNote: "Les détails restent dans la langue utilisée lors de la vérification.",
    historyClear: "Effacer l'historique", historyEmpty: "Aucune vérification enregistrée.",
    historyTypeUrl: "Vérification de lien", historyTypeMessage: "Vérification de message", historyStorageError: "Le stockage du navigateur est indisponible ; cette vérification n'a pas pu être enregistrée.",
    historyCleared: "L'historique local a été effacé.",
    safetyCenterEyebrow: "OUTILS PRATIQUES", safetyCenterTitle: "Trouvez de l'aide et adoptez de bons réflexes.",
    responseEyebrow: "SI QUELQUE CHOSE S'EST PRODUIT", responseTitle: "Que faire maintenant ?",
    responseScenarioLabel: "Choisissez ce qui s'est passé", responseScenarioCode: "J'ai partagé un code à usage unique ou un mot de passe",
    responseScenarioPayment: "J'ai envoyé de l'argent ou payé des frais", responseScenarioDevice: "J'ai installé une application ou donné accès à mon appareil",
    responseScenarioLink: "J'ai ouvert un lien ou saisi les informations de mon compte",
    countryHelpEyebrow: "ASSISTANCE OFFICIELLE", countryHelpTitle: "Trouvez de l'aide dans votre pays", countrySelectLabel: "Choisissez un pays",
    countryHelpNote: "Ces liens mènent à des services officiels de signalement ou de cybersécurité. Leur disponibilité et leur champ d'action varient. En cas de perte financière urgente, contactez votre banque avec un numéro de confiance.",
    countryUS: "États-Unis", countryCanada: "Canada", countryIndia: "Inde", countryFrance: "France",
    countryLinkReport: "Signaler ou obtenir des conseils officiels", countryOrgFtc: "Commission fédérale du commerce — ReportFraud", countryOrgCafc: "Centre antifraude du Canada", countryOrgIndia: "Portail national de signalement de la cybercriminalité", countryOrgFrance: "Cybermalveillance.gouv.fr",
    quizEyebrow: "ENTRAÎNEZ-VOUS À REPÉRER LES ARNAQUES", quizTitle: "Quiz rapide de sécurité",
    quizIntro: "Essayez trois courtes situations. Vos réponses restent dans cette session du navigateur.",
    quizStart: "Commencer", quizNext: "Question suivante", quizFinish: "Voir mon résultat", quizAgain: "Recommencer",
    quizQuestion: "Question", quizCorrect: "Bon choix.", quizIncorrect: "Ce n'est pas le choix le plus sûr.",
    quizScore: "Vous avez {score} bonne(s) réponse(s) sur {total}. Utilisez les canaux officiels et ne partagez jamais de codes à usage unique.",
    plannerScenarios: {
      code: { label: "J'ai partagé un code à usage unique ou un mot de passe", steps: ["Contactez immédiatement le service ou la banque par son application officielle ou un numéro de confiance ; demandez la sécurisation du compte.", "Changez le mot de passe depuis le site ou l'application officielle. Déconnectez les autres sessions et activez l'authentification multifacteur si possible.", "Contactez votre opérateur si votre ligne cesse soudainement de fonctionner. Conservez les messages et ne partagez plus aucun code."] },
      payment: { label: "J'ai envoyé de l'argent ou payé des frais", steps: ["Appelez immédiatement votre banque ou prestataire de paiement avec le numéro figurant sur votre carte ou son application officielle. Demandez si le paiement peut être bloqué ou contesté.", "Conservez les reçus, noms de compte, messages et références de transaction. Signalez l'incident au service officiel de votre pays.", "N'envoyez plus d'argent, même pour récupérer les fonds. Les offres de récupération exigeant un paiement à l'avance sont souvent une autre arnaque."] },
      device: { label: "J'ai installé une application ou donné accès à mon appareil", steps: ["Déconnectez l'appareil d'Internet si quelqu'un le contrôle. Ne l'utilisez pas pour accéder à votre banque ou à vos e-mails.", "Depuis un autre appareil de confiance, contactez votre banque, changez vos mots de passe importants et révoquez les sessions ou accès inconnus.", "Demandez à un technicien de confiance ou à un service officiel de vérifier l'appareil. Conservez les messages et détails de l'application."] },
      link: { label: "J'ai ouvert un lien ou saisi les informations de mon compte", steps: ["Si vous avez seulement ouvert la page, fermez-la et ne téléchargez rien ni ne saisissez d'autres informations.", "Si vous avez saisi un mot de passe, changez-le via le site ou l'application officielle depuis un appareil de confiance et sécurisez les comptes où il est réutilisé.", "Si vous avez partagé des données de paiement ou d'identité, contactez la banque ou le prestataire concerné et suivez les consignes officielles de signalement de votre pays."] },
    },
    statusPending: "en attente d'examen", statusVerified: "vérifié", statusRejected: "rejeté", statusEscalated: "transmis",
    errorCategory: "Choisissez une catégorie de signalement.", errorSummary: "Ajoutez des précisions (au moins 12 caractères).",
    errorReportNotFound: "Aucun signalement ne correspond à cette référence.", errorNetwork: "Connexion au serveur impossible. Vérifiez votre connexion.",
  },
  hi: {
    pageTitle: "ScamShield — रुकें, जाँचें, सुरक्षित रहें",
    languageSelectLabel: "भाषा चुनें", skipLink: "मुख्य सामग्री पर जाएँ",
    mainNavigation: "मुख्य नेविगेशन", navCheck: "संदेश जाँचें", navGuides: "सुरक्षा मार्गदर्शिकाएँ", navSafetyCenter: "सुरक्षा साधन", navReport: "धोखाधड़ी की रिपोर्ट करें", navModerator: "समीक्षा",
    heroEyebrow: "शांति से जाँचें", heroLineOne: "क्या यह संदेश संदिग्ध लगता है?", heroLineTwo: "आइए, ध्यान से देखें।",
    heroText: "संदिग्ध लिंक या संदेश जाँचें। चेतावनी के संकेत समझें, जाँच का विवरण देखें और सुरक्षित अगला कदम चुनें।",
    privacyPill: "गोपनीयता पहले · खाता आवश्यक नहीं", artPause: "पहले रुकें", artCheck: "विवरण जाँचें",
    quickCheck: "त्वरित जाँच", checkerHeading: "आप क्या जाँचना चाहते हैं?", checkLabel: "जाँचें",
    tablist: "जाँचने के लिए चुनें", tabUrl: "लिंक", tabMessage: "संदेश",
    urlLabel: "जाँचने के लिए वेब पता पेस्ट करें", urlPlaceholder: "example.in/offer", checkLink: "लिंक जाँचें",
    urlPrivacy: "हम लिंक कभी नहीं खोलते। निजी टोकन या व्यक्तिगत जानकारी वाले लिंक पेस्ट न करें।",
    messageLabel: "संदिग्ध संदेश पेस्ट करें", messagePlaceholder: "यहाँ संदेश पेस्ट करें — पहले नाम, फ़ोन नंबर और कोड हटा दें।",
    messagePrivacy: "इस सर्वर पर मेमोरी में विश्लेषण होता है। इसे सहेजा या बाहरी सेवा को भेजा नहीं जाता।", checkMessage: "संदेश जाँचें",
    finePrint: "ScamShield एक स्वतंत्र शैक्षिक टूल है — सरकारी सेवा या सुरक्षा की गारंटी नहीं।",
    howEyebrow: "स्पष्ट और सरल", howTitle: "जानें किस संकेत ने चेताया।",
    howText: "हम परिणाम के पीछे के संकेत बताते हैं ताकि आप अगला कदम चुन सकें।",
    howOneTitle: "क्लिक किए बिना जाँचें", howOneText: "लिंक या संदेश पेस्ट करें। हम केवल टेक्स्ट देखते हैं; संदिग्ध लिंक नहीं खोलते।",
    howTwoTitle: "संकेत देखें", howTwoText: "जानें कौन-से पैटर्न मिले और कौन-सी जाँच उपलब्ध नहीं थी।",
    howThreeTitle: "सुरक्षित कदम चुनें", howThreeText: "उपयोगी सलाह पाएँ। संदेह हो तो स्वयं खोजे गए आधिकारिक माध्यम से पुष्टि करें।",
    guidesEyebrow: "काम की सुरक्षा सलाह", guidesTitle: "इन्हें याद रखें।",
    guideSearchLabel: "सुरक्षा मार्गदर्शिका खोजें", guideSearchPlaceholder: "सुरक्षा सलाह खोजें", guideFilters: "सुरक्षा सलाह फ़िल्टर करें",
    guideAll: "सभी", guideAccount: "खाते और कोड", guidePayments: "भुगतान और नौकरी", guideShopping: "खरीदारी और लिंक",
    helpEyebrow: "क्या पैसे भेजे या कोड साझा किया?", helpTitle: "जल्दी कदम उठाएँ। मदद उपलब्ध है।",
    helpText: "अपने बैंक या भुगतान सेवा से उसके आधिकारिक ऐप/नंबर पर संपर्क करें, प्रभावित पासवर्ड बदलें और संदेश सुरक्षित रखें।",
    helpLink: "अपने देश में आधिकारिक सहायता पाएँ", reportEyebrow: "दूसरों को सतर्क रहने में मदद करें",
    reportTitle: "संदिग्ध घटना की रिपोर्ट करें।", reportIntro: "रिपोर्ट निजी रहती है और समीक्षा की प्रतीक्षा करती है। जाँच के बिना सार्वजनिक नहीं होती।",
    reportPrivacy: "आपकी रिपोर्ट निजी है। OTP, पासवर्ड या पहचान की निजी जानकारी न दें।",
    reportCategoryLabel: "किस प्रकार की धोखाधड़ी?", categoryChoose: "श्रेणी चुनें", categoryShop: "नकली दुकान या उत्पाद",
    categoryJob: "नौकरी या कमाई का प्रस्ताव", categoryPayment: "भुगतान या डिलीवरी का अनुरोध", categoryImpersonation: "किसी संस्था की नकल",
    categoryAccount: "खाता एक्सेस या सत्यापन", categoryOther: "अन्य", reportTargetLabel: "लिंक या खाते की पहचान (वैकल्पिक)",
    reportTargetPlaceholder: "example.in — निजी टोकन न डालें", reportSummaryLabel: "क्या हुआ?",
    reportSummaryPlaceholder: "अनुरोध का संक्षिप्त विवरण दें। नाम, फ़ोन नंबर और कोड हटा दें।",
    reportSubmit: "निजी रिपोर्ट भेजें", statusEyebrow: "निजी रूप से स्थिति देखें", statusTitle: "रिपोर्ट की स्थिति देखें",
    statusText: "रिपोर्ट के बाद मिला निजी संदर्भ दर्ज करें।", statusLabel: "निजी रिपोर्ट संदर्भ",
    statusPlaceholder: "आपका निजी संदर्भ", statusSubmit: "स्थिति जाँचें", moderatorSummary: "समीक्षक प्रवेश",
    moderatorIntro: "केवल अधिकृत समीक्षकों के लिए। उपयोग से पहले सर्वर पर SCAMSHIELD_ADMIN_TOKEN सेट करें।",
    moderatorTokenLabel: "समीक्षक टोकन", moderatorLoad: "लंबित रिपोर्ट लोड करें",
    footerIntro: "स्वतंत्र शैक्षिक निर्णय-सहायक परियोजना। कोई परिणाम लिंक या संदेश के सुरक्षित होने की गारंटी नहीं देता।",
    footerCheck: "जाँचें", footerReport: "रिपोर्ट", footerGuides: "सुरक्षा सलाह", footerHelp: "आधिकारिक सहायता ↗",
    footerDisclaimer: "ScamShield किसी सरकारी सेवा से संबद्ध नहीं है।",
    checking: "जाँच रहे हैं…", sending: "निजी रिपोर्ट भेज रहे हैं…",
    reportSuccess: "रिपोर्ट मिली और समीक्षा की प्रतीक्षा में है। स्थिति देखने के लिए यह निजी संदर्भ सुरक्षित रखें:",
    statusLoading: "रिपोर्ट खोज रहे हैं…", statusResult: "रिपोर्ट की स्थिति:", lastUpdated: "आख़िरी बार अपडेट",
    queueEmpty: "समीक्षा के लिए कोई रिपोर्ट लंबित नहीं है।", target: "लक्ष्य:", pendingCount: "लंबित रिपोर्ट।",
    promptReason: "इस रिपोर्ट को चिह्नित करने का संक्षिप्त कारण लिखें",
    riskHigh: "ज़्यादा जोखिम के संकेत", riskCaution: "रुकें और जाँचें", riskUnknown: "निर्धारित नहीं किया जा सका",
    riskNoKnown: "कोई ज्ञात खतरा नहीं मिला", riskKnown: "ज्ञात खतरे से मेल",
    resultUnknown: "उपलब्ध जाँच से विश्वसनीय निर्णय नहीं हो सका।",
    resultRisk: "यह जोखिम का संकेत है, किसी व्यक्ति या संस्था के धोखेबाज़ होने का प्रमाण नहीं।",
    resultEvidence: "हमें क्या दिखा", resultNoEvidence: "स्थानीय नियमों में कोई मज़बूत संकेत नहीं मिला।",
    resultLinks: "मिले लिंक (खोले नहीं गए):", resultNext: "सुरक्षित अगला कदम",
    resultCoverage: "स्थानीय नियम: पूरे · लाइव खतरा-सूची जाँच: उपलब्ध नहीं",
    resultDisclaimer: "कोई परिणाम सुरक्षित होने की गारंटी नहीं दे सकता।",
    guidesNoMatch: "इस खोज से कोई सलाह नहीं मिली। दूसरा शब्द या श्रेणी आज़माएँ।",
    strengthWeak: "कमज़ोर संकेत", strengthMedium: "मध्यम संकेत", strengthStrong: "मज़बूत संकेत",
    categoryNames: {all:"सभी",account:"खाते और कोड",payments:"भुगतान और नौकरी",shopping:"खरीदारी और लिंक"},
    historyEyebrow: "केवल इस ब्राउज़र में निजी", historyTitle: "हाल की जाँच",
    historyPrivacy: "केवल इसी डिवाइस पर सहेजा जाता है। मूल लिंक और संदेश सहेजे नहीं जाते। इतिहास कभी भी मिटाएँ।",
    historyLanguageNote: "सहेजे गए नतीजे का विवरण जाँच के समय वाली भाषा में रहेगा।",
    historyClear: "इतिहास मिटाएँ", historyEmpty: "अभी तक कोई जाँच सहेजी नहीं गई।",
    historyTypeUrl: "लिंक जाँच", historyTypeMessage: "संदेश जाँच", historyStorageError: "ब्राउज़र स्टोरेज उपलब्ध नहीं है, इसलिए यह जाँच सहेजी नहीं जा सकी।",
    historyCleared: "डिवाइस पर सहेजा गया जाँच इतिहास मिटा दिया गया है।",
    safetyCenterEyebrow: "काम के सुरक्षा साधन", safetyCenterTitle: "मदद पाएँ और सुरक्षित आदतें सीखें।",
    responseEyebrow: "अगर कुछ हो चुका है", responseTitle: "अब मुझे क्या करना चाहिए?",
    responseScenarioLabel: "चुनें कि क्या हुआ", responseScenarioCode: "मैंने एक बार का कोड या पासवर्ड साझा किया",
    responseScenarioPayment: "मैंने पैसे भेजे या शुल्क दिया", responseScenarioDevice: "मैंने ऐप इंस्टॉल किया या डिवाइस का ऐक्सेस दिया",
    responseScenarioLink: "मैंने लिंक खोला या खाते की जानकारी भरी",
    countryHelpEyebrow: "आधिकारिक सहायता", countryHelpTitle: "अपने देश में सहायता पाएँ", countrySelectLabel: "देश चुनें",
    countryHelpNote: "ये लिंक आधिकारिक रिपोर्टिंग या साइबर-सुरक्षा सेवाओं के हैं। उनकी उपलब्धता और अधिकार-क्षेत्र अलग हो सकते हैं। तुरंत वित्तीय नुकसान होने पर भरोसेमंद नंबर से बैंक से संपर्क करें।",
    countryUS: "संयुक्त राज्य", countryCanada: "कनाडा", countryIndia: "भारत", countryFrance: "फ्रांस",
    countryLinkReport: "रिपोर्ट करें या आधिकारिक मार्गदर्शन पाएँ", countryOrgFtc: "फ़ेडरल ट्रेड कमीशन — ReportFraud", countryOrgCafc: "कनाडाई एंटी-फ्रॉड सेंटर", countryOrgIndia: "राष्ट्रीय साइबर अपराध रिपोर्टिंग पोर्टल", countryOrgFrance: "Cybermalveillance.gouv.fr",
    quizEyebrow: "धोखाधड़ी पहचानने का अभ्यास करें", quizTitle: "छोटी सुरक्षा प्रश्नोत्तरी",
    quizIntro: "तीन छोटे उदाहरण आज़माएँ। आपके जवाब इसी ब्राउज़र सत्र में रहते हैं।",
    quizStart: "शुरू करें", quizNext: "अगला सवाल", quizFinish: "नतीजा देखें", quizAgain: "फिर से खेलें",
    quizQuestion: "सवाल", quizCorrect: "सही चुनाव।", quizIncorrect: "यह सबसे सुरक्षित विकल्प नहीं था।",
    quizScore: "आपने {total} में से {score} सही किए। आधिकारिक माध्यमों का उपयोग करें और एक बार का कोड कभी साझा न करें।",
    plannerScenarios: {
      code: { label: "मैंने एक बार का कोड या पासवर्ड साझा किया", steps: ["आधिकारिक ऐप या पहले से भरोसेमंद नंबर से सेवा या बैंक से तुरंत संपर्क करें और खाते को सुरक्षित करने को कहें।", "आधिकारिक साइट या ऐप से पासवर्ड बदलें। अन्य सत्रों से साइन आउट करें और उपलब्ध हो तो बहु-कारक प्रमाणीकरण चालू करें।", "फ़ोन सेवा अचानक बंद हो तो मोबाइल सेवा प्रदाता से संपर्क करें। संदेश सहेजें और कोई और कोड साझा न करें।"] },
      payment: { label: "मैंने पैसे भेजे या शुल्क दिया", steps: ["कार्ड पर दिए नंबर या आधिकारिक ऐप से बैंक/भुगतान सेवा को तुरंत कॉल करें। पूछें कि भुगतान रोका या विवादित किया जा सकता है या नहीं।", "रसीदें, खाते के नाम, संदेश और लेन-देन संदर्भ सहेजें। अपने देश की आधिकारिक सेवा में घटना की रिपोर्ट करें।", "पैसे वापस दिलाने के नाम पर भी और पैसे न भेजें। पहले से शुल्क माँगने वाली रिकवरी सेवाएँ अक्सर एक और धोखाधड़ी होती हैं।"] },
      device: { label: "मैंने ऐप इंस्टॉल किया या डिवाइस का ऐक्सेस दिया", steps: ["अगर कोई डिवाइस नियंत्रित कर रहा है तो उसे इंटरनेट से अलग करें। उससे बैंक या ईमेल में साइन इन न करें।", "दूसरे भरोसेमंद डिवाइस से बैंक से संपर्क करें, महत्वपूर्ण पासवर्ड बदलें और अनजान सत्र या ऐक्सेस रद्द करें।", "भरोसेमंद तकनीशियन या आधिकारिक सहायता से डिवाइस जाँचें। संदेश और ऐप का विवरण सबूत के लिए सहेजें।"] },
      link: { label: "मैंने लिंक खोला या खाते की जानकारी भरी", steps: ["अगर आपने सिर्फ पेज खोला था, उसे बंद करें और फ़ाइल डाउनलोड या और जानकारी दर्ज न करें।", "पासवर्ड दर्ज किया हो तो भरोसेमंद डिवाइस से आधिकारिक ऐप/साइट पर बदलें और जहाँ वही पासवर्ड इस्तेमाल किया है उन खातों को भी सुरक्षित करें।", "भुगतान या पहचान की जानकारी साझा की हो तो संबंधित बैंक/सेवा से संपर्क करें और देश की आधिकारिक रिपोर्टिंग सलाह अपनाएँ।"] },
    },
    statusPending: "समीक्षा लंबित", statusVerified: "सत्यापित", statusRejected: "अस्वीकृत", statusEscalated: "आगे भेजा",
    errorCategory: "रिपोर्ट की सूची में से श्रेणी चुनें।", errorSummary: "थोड़ा और विवरण दें (कम से कम 12 अक्षर)।",
    errorReportNotFound: "इस संदर्भ से कोई रिपोर्ट नहीं मिली।", errorNetwork: "सर्वर से संपर्क नहीं हो सका। अपना कनेक्शन जाँचें।",
  },
  ar: {
    pageTitle: "ScamShield — توقف، تحقق، احمِ نفسك",
    languageSelectLabel: "اختر اللغة", skipLink: "انتقل إلى المحتوى",
    mainNavigation: "التنقل الرئيسي", navCheck: "تحقق من رسالة", navGuides: "إرشادات الأمان", navSafetyCenter: "أدوات الأمان", navReport: "أبلغ عن احتيال", navModerator: "المراجعة",
    heroEyebrow: "تحقق بهدوء", heroLineOne: "هل تبدو هذه الرسالة مريبة؟", heroLineTwo: "لنراجعها معاً.",
    heroText: "تحقق من رابط أو رسالة مريبة. اطّلع على المؤشرات وافهم ما فحصناه واختر خطوة تالية أكثر أماناً.",
    privacyPill: "الخصوصية أولاً · لا حاجة إلى حساب", artPause: "توقف أولاً", artCheck: "تحقق من التفاصيل",
    quickCheck: "فحص سريع", checkerHeading: "ما الذي تريد فحصه؟", checkLabel: "افحص",
    tablist: "اختر ما تريد فحصه", tabUrl: "رابط", tabMessage: "رسالة",
    urlLabel: "ألصق عنوان الويب الذي تريد فحصه", urlPlaceholder: "example.com/offer", checkLink: "افحص الرابط",
    urlPrivacy: "لا نفتح الرابط مطلقاً. لا تلصق روابط تتضمن رموزاً خاصة أو بيانات شخصية.",
    messageLabel: "ألصق النص المريب", messagePlaceholder: "ألصق الرسالة هنا — احذف الأسماء وأرقام الهاتف والرموز أولاً.",
    messagePrivacy: "يُحلل النص في ذاكرة هذا الخادم. لا يُحفظ ولا يُرسل إلى خدمة خارجية.", checkMessage: "افحص الرسالة",
    finePrint: "ScamShield أداة تعليمية مستقلة، وليست خدمة حكومية أو ضماناً للأمان.",
    howEyebrow: "واضح وبسيط", howTitle: "افهم المؤشرات التي ظهرت.",
    howText: "نعرض المؤشرات لتتمكن من اختيار ما ستفعله لاحقاً.",
    howOneTitle: "تحقق دون النقر", howOneText: "ألصق رابطاً أو رسالة. نفحص النص فقط ولا نفتح الروابط المريبة.",
    howTwoTitle: "اطّلع على المؤشرات", howTwoText: "اعرف الأنماط التي رصدناها والفحوصات غير المتاحة.",
    howThreeTitle: "اختر خطوة آمنة", howThreeText: "احصل على نصائح عملية. عند الشك، تحقق عبر قناة رسمية تبحث عنها بنفسك.",
    guidesEyebrow: "نصائح مفيدة", guidesTitle: "احتفظ بهذه الإرشادات.",
    guideSearchLabel: "ابحث في إرشادات الأمان", guideSearchPlaceholder: "ابحث في إرشادات الأمان", guideFilters: "تصفية إرشادات الأمان",
    guideAll: "الكل", guideAccount: "الحسابات والرموز", guidePayments: "المدفوعات والوظائف", guideShopping: "التسوق والروابط",
    helpEyebrow: "هل أرسلت أموالاً أو شاركت رمزاً؟", helpTitle: "تصرّف بسرعة. المساعدة متاحة.",
    helpText: "اتصل بالبنك أو مزود الدفع عبر التطبيق أو الرقم الرسمي، وغيّر كلمات المرور المتأثرة واحتفظ بالرسائل.",
    helpLink: "اعثر على مساعدة رسمية في بلدك", reportEyebrow: "ساعد الآخرين على البقاء يقظين",
    reportTitle: "أبلغ عن حادثة مريبة.", reportIntro: "تظل البلاغات خاصة وقيد المراجعة، ولا تُنشر دون مراجعتها.",
    reportPrivacy: "بلاغك خاص. لا تذكر رموز OTP أو كلمات المرور أو بيانات الهوية الشخصية.",
    reportCategoryLabel: "ما نوع الاحتيال؟", categoryChoose: "اختر فئة", categoryShop: "متجر أو منتج مزيف",
    categoryJob: "عرض عمل أو دخل", categoryPayment: "طلب دفع أو توصيل", categoryImpersonation: "انتحال صفة مؤسسة",
    categoryAccount: "الوصول إلى الحساب أو التحقق", categoryOther: "غير ذلك", reportTargetLabel: "الرابط أو معرّف الحساب (اختياري)",
    reportTargetPlaceholder: "example.com — لا تدرج رموزاً خاصة", reportSummaryLabel: "ماذا حدث؟",
    reportSummaryPlaceholder: "صف الطلب بإيجاز. احذف الأسماء وأرقام الهاتف والرموز.",
    reportSubmit: "أرسل بلاغاً خاصاً", statusEyebrow: "متابعة خاصة", statusTitle: "تحقق من حالة البلاغ",
    statusText: "أدخل المرجع الخاص الذي تلقيته بعد الإبلاغ.", statusLabel: "مرجع البلاغ الخاص",
    statusPlaceholder: "مرجعك الخاص", statusSubmit: "تحقق من الحالة", moderatorSummary: "دخول المراجع",
    moderatorIntro: "للمراجعين المصرح لهم فقط. أعد إعداد SCAMSHIELD_ADMIN_TOKEN على الخادم.",
    moderatorTokenLabel: "رمز المراجع", moderatorLoad: "تحميل البلاغات المعلقة",
    footerIntro: "مشروع تعليمي مستقل للمساعدة على اتخاذ القرار. لا تضمن أي نتيجة أمان رابط أو رسالة.",
    footerCheck: "تحقق", footerReport: "إبلاغ", footerGuides: "نصائح الأمان", footerHelp: "مساعدة رسمية ↗",
    footerDisclaimer: "لا يرتبط ScamShield بأي خدمة حكومية.",
    checking: "جارٍ الفحص…", sending: "جارٍ إرسال البلاغ الخاص…",
    reportSuccess: "تم استلام البلاغ وهو قيد المراجعة. احتفظ بهذا المرجع الخاص لمتابعة الحالة:",
    statusLoading: "جارٍ البحث عن البلاغ…", statusResult: "حالة البلاغ:", lastUpdated: "آخر تحديث",
    queueEmpty: "لا توجد بلاغات بانتظار المراجعة.", target: "الهدف:", pendingCount: "بلاغات معلقة.",
    promptReason: "أضف سبباً موجزاً لوضع علامة على هذا البلاغ",
    riskHigh: "مؤشرات خطورة مرتفعة", riskCaution: "توقف وتحقق", riskUnknown: "تعذر التحديد",
    riskNoKnown: "لم يُعثر على تهديد معروف", riskKnown: "تطابق مع تهديد معروف",
    resultUnknown: "لا تسمح الفحوصات المتاحة باستنتاج موثوق.",
    resultRisk: "هذا مؤشر خطر، وليس دليلاً على احتيال شخص أو مؤسسة.",
    resultEvidence: "ما لاحظناه", resultNoEvidence: "لم تعثر القواعد المحلية على مؤشرات قوية.",
    resultLinks: "روابط تم العثور عليها (لم تُفتح):", resultNext: "خطوة تالية أكثر أماناً",
    resultCoverage: "القواعد المحلية: مكتملة · الفحص المباشر لقوائم التهديدات: غير مُعد",
    resultDisclaimer: "لا يمكن لأي نتيجة أن تضمن الأمان.",
    guidesNoMatch: "لم نعثر على إرشادات مطابقة. جرّب كلمة أو فئة أخرى.",
    strengthWeak: "مؤشر ضعيف", strengthMedium: "مؤشر متوسط", strengthStrong: "مؤشر قوي",
    categoryNames: {all:"الكل",account:"الحسابات والرموز",payments:"المدفوعات والوظائف",shopping:"التسوق والروابط"},
    historyEyebrow: "خاص بهذا المتصفح", historyTitle: "الفحوصات الأخيرة",
    historyPrivacy: "يُحفظ على هذا الجهاز فقط. لا تُحفظ الروابط أو الرسائل الأصلية. يمكنك مسح السجل في أي وقت.",
    historyLanguageNote: "تبقى تفاصيل النتيجة باللغة المستخدمة عند إجراء الفحص.",
    historyClear: "مسح السجل", historyEmpty: "لا توجد فحوصات محفوظة بعد.",
    historyTypeUrl: "فحص رابط", historyTypeMessage: "فحص رسالة", historyStorageError: "مساحة تخزين المتصفح غير متاحة، لذلك تعذر حفظ هذا الفحص.",
    historyCleared: "تم مسح سجل الفحوصات المحلي.",
    safetyCenterEyebrow: "أدوات أمان عملية", safetyCenterTitle: "احصل على المساعدة وتعلّم عادات أكثر أماناً.",
    responseEyebrow: "إذا حدث أمر ما", responseTitle: "ماذا أفعل الآن؟",
    responseScenarioLabel: "اختر ما حدث", responseScenarioCode: "شاركت رمزاً لمرة واحدة أو كلمة مرور",
    responseScenarioPayment: "أرسلت المال أو دفعت رسوماً", responseScenarioDevice: "ثبّت تطبيقاً أو منحت الوصول إلى جهازي",
    responseScenarioLink: "فتحت رابطاً أو أدخلت بيانات حسابي",
    countryHelpEyebrow: "دعم رسمي", countryHelpTitle: "اعثر على مساعدة في بلدك", countrySelectLabel: "اختر بلداً",
    countryHelpNote: "تؤدي هذه الروابط إلى خدمات رسمية للإبلاغ أو السلامة السيبرانية. يختلف توفرها واختصاصها. عند خسارة مالية عاجلة، اتصل بالبنك عبر رقم موثوق.",
    countryUS: "الولايات المتحدة", countryCanada: "كندا", countryIndia: "الهند", countryFrance: "فرنسا",
    countryLinkReport: "أبلغ أو احصل على إرشادات رسمية", countryOrgFtc: "لجنة التجارة الفيدرالية — ReportFraud", countryOrgCafc: "المركز الكندي لمكافحة الاحتيال", countryOrgIndia: "البوابة الوطنية للإبلاغ عن الجرائم الإلكترونية", countryOrgFrance: "Cybermalveillance.gouv.fr",
    quizEyebrow: "تدرّب على اكتشاف الاحتيال", quizTitle: "اختبار أمان سريع",
    quizIntro: "جرّب ثلاثة مواقف قصيرة. تبقى إجاباتك في جلسة المتصفح هذه.",
    quizStart: "ابدأ الاختبار", quizNext: "السؤال التالي", quizFinish: "اعرض نتيجتي", quizAgain: "حاول مرة أخرى",
    quizQuestion: "السؤال", quizCorrect: "اختيار جيد.", quizIncorrect: "هذا ليس الخيار الأكثر أماناً.",
    quizScore: "أجبت بشكل صحيح عن {score} من {total}. استخدم القنوات الرسمية ولا تشارك الرموز لمرة واحدة أبداً.",
    plannerScenarios: {
      code: { label: "شاركت رمزاً لمرة واحدة أو كلمة مرور", steps: ["اتصل بالخدمة أو البنك فوراً عبر التطبيق الرسمي أو رقم تعرفه وتثق به، واطلب تأمين الحساب.", "غيّر كلمة المرور عبر الموقع أو التطبيق الرسمي. سجّل الخروج من الجلسات الأخرى وفعّل المصادقة متعددة العوامل إن توفرت.", "اتصل بمزود الهاتف إذا توقفت الخدمة فجأة. احتفظ بالرسائل ولا تشارك أي رموز أخرى."] },
      payment: { label: "أرسلت المال أو دفعت رسوماً", steps: ["اتصل بالبنك أو مزود الدفع فوراً باستخدام الرقم على بطاقتك أو التطبيق الرسمي. اسأل إن كان بالإمكان إيقاف الدفع أو الاعتراض عليه.", "احتفظ بالإيصالات وأسماء الحسابات والرسائل ومراجع المعاملات. أبلغ عبر الخدمة الرسمية في بلدك.", "لا ترسل مزيداً من المال لاسترداد المبلغ. عروض الاسترداد التي تطلب دفعاً مسبقاً غالباً ما تكون احتيالاً آخر."] },
      device: { label: "ثبّت تطبيقاً أو منحت الوصول إلى جهازي", steps: ["افصل الجهاز عن الإنترنت إذا كان شخص ما يتحكم فيه. لا تستخدمه لتسجيل الدخول إلى البنك أو البريد الإلكتروني.", "من جهاز موثوق آخر، اتصل بالبنك وغيّر كلمات المرور المهمة وألغِ الجلسات أو صلاحيات الوصول المجهولة.", "اطلب من فني موثوق أو خدمة دعم رسمية فحص الجهاز. احتفظ بالرسائل وتفاصيل التطبيق كأدلة."] },
      link: { label: "فتحت رابطاً أو أدخلت بيانات حسابي", steps: ["إذا فتحت الصفحة فقط، فأغلقها ولا تنزّل ملفات أو تدخل مزيداً من المعلومات.", "إذا أدخلت كلمة مرور، فغيّرها عبر التطبيق أو الموقع الرسمي من جهاز موثوق وأمّن الحسابات التي تستخدم فيها الكلمة نفسها.", "إذا شاركت بيانات الدفع أو الهوية، فاتصل بالبنك أو المزود المعني واتبع إرشادات الإبلاغ الرسمية في بلدك."] },
    },
    statusPending: "بانتظار المراجعة", statusVerified: "تم التحقق", statusRejected: "مرفوض", statusEscalated: "تمت الإحالة",
    errorCategory: "اختر فئة من القائمة.", errorSummary: "أضف مزيداً من التفاصيل (12 حرفاً على الأقل).",
    errorReportNotFound: "لم يُعثر على بلاغ بهذا المرجع.", errorNetwork: "تعذر الاتصال بالخادم. تحقق من الاتصال.",
  },
};

const guideData = [
  {category:"account",icon:"🔐",title:["Never share an OTP or PIN","ওটিপি বা পিন কাউকে দেবেন না"],summary:["Banks and legitimate support teams do not need your one-time password to reverse a payment or secure an account.","পেমেন্ট ফেরত বা অ্যাকাউন্ট সুরক্ষিত করার জন্য ব্যাংক বা আসল সহায়তা-কর্মীর আপনার ওয়ান-টাইম পাসওয়ার্ড দরকার হয় না।"],steps:[
    ["End the call or chat. Do not share the code, even if the person knows your name.","ফোন বা চ্যাট বন্ধ করুন। পরিচিত তথ্য জানলেও কোডটি দেবেন না।"],
    ["Open the official app yourself and review recent activity.","নিজে অফিসিয়াল অ্যাপ খুলে সাম্প্রতিক কার্যক্রম দেখুন।"],
    ["If you already shared it, contact your bank/provider immediately using a trusted number.","ইতিমধ্যে দিয়ে থাকলে, আগে থেকে জানা বিশ্বস্ত নম্বরে ব্যাংক/সেবাদাতাকে দ্রুত জানান।"]]},
  {category:"account",icon:"🧭",title:["Verify account warnings independently","অ্যাকাউন্টের সতর্কতা নিজে যাচাই করুন"],summary:["A message saying an account will close may be designed to make you panic and sign in on a fake page.","অ্যাকাউন্ট বন্ধের ভয় দেখানো বার্তা আপনাকে আতঙ্কিত করে ভুয়া পাতায় লগইন করাতে পারে।"],steps:[
    ["Do not use the message's login link or phone number.","বার্তার দেওয়া লগইন লিংক বা ফোন নম্বর ব্যবহার করবেন না।"],
    ["Type the known official address yourself or open the official app.","পরিচিত অফিসিয়াল ঠিকানা নিজে লিখুন বা অফিসিয়াল অ্যাপ খুলুন।"],
    ["Check for alerts inside your account and change your password there if needed.","অ্যাকাউন্টে সতর্কতা দেখুন; প্রয়োজন হলে সেখান থেকেই পাসওয়ার্ড বদলান।"]]},
  {category:"payments",icon:"⏸",title:["Slow down urgent payment demands","জরুরি পেমেন্টের চাপে তাড়াহুড়ো করবেন না"],summary:["Scammers create deadlines or threats so you skip the normal checks.","স্বাভাবিক যাচাই এড়াতে প্রতারকেরা সময়সীমা বা হুমকি দিয়ে চাপ দিতে পারে।"],steps:[
    ["Pause. A real bill can be confirmed through a separate official channel.","থামুন। আলাদা কোনো অফিসিয়াল মাধ্যমে আসল বিল যাচাই করা যায়।"],
    ["Call a known contact number; do not rely on caller ID or a number in the message.","আগে থেকে জানা নম্বরে কল করুন; কলার আইডি বা বার্তার নম্বরের ওপর নির্ভর করবেন না।"],
    ["Do not install remote-access apps or share your screen at a stranger's request.","অপরিচিত কারও কথায় রিমোট-অ্যাক্সেস অ্যাপ ইনস্টল বা স্ক্রিন শেয়ার করবেন না।"]]},
  {category:"payments",icon:"💼",title:["Check job offers that ask for money","টাকা চাওয়া চাকরির প্রস্তাব যাচাই করুন"],summary:["Upfront registration, training, equipment, or security fees can be a warning sign in an unsolicited job offer.","অনাকাঙ্ক্ষিত চাকরির প্রস্তাবে আগে নিবন্ধন, প্রশিক্ষণ, সরঞ্জাম বা জামানতের টাকা চাওয়া সতর্কতার সংকেত হতে পারে।"],steps:[
    ["Verify the vacancy on the organization's official careers page.","প্রতিষ্ঠানের অফিসিয়াল চাকরির পাতায় পদটি যাচাই করুন।"],
    ["Contact the employer using contact details found independently.","নিজে খুঁজে পাওয়া যোগাযোগের তথ্য দিয়ে নিয়োগদাতাকে যাচাই করুন।"],
    ["Do not pay to unlock a job or withdraw supposed earnings.","চাকরি পেতে বা কথিত আয় তুলতে টাকা দেবেন না।"]]},
  {category:"shopping",icon:"🛍️",title:["Check an unfamiliar online shop","অপরিচিত অনলাইন দোকান যাচাই করুন"],summary:["A polished page or padlock icon does not prove that a seller is genuine.","সুন্দর ওয়েবসাইট বা তালার চিহ্ন থাকলেই বিক্রেতা আসল প্রমাণ হয় না।"],steps:[
    ["Search the shop name and exact address independently, including complaints.","দোকানের নাম ও ঠিকানা আলাদাভাবে খুঁজে অভিযোগ আছে কি না দেখুন।"],
    ["Compare the return policy, contact details, and payment recipient.","ফেরত নীতি, যোগাযোগের তথ্য ও পেমেন্টপ্রাপকের তথ্য মিলিয়ে নিন।"],
    ["Avoid irreversible payment methods if you cannot verify the seller.","বিক্রেতাকে যাচাই করতে না পারলে ফেরত-অযোগ্য পেমেন্ট এড়িয়ে চলুন।"]]},
  {category:"shopping",icon:"🔗",title:["Inspect a link without opening it","না খুলেই লিংক যাচাই করুন"],summary:["A displayed brand name can hide a different destination. Short links hide where they lead.","দেখানো ব্র্যান্ডের নামের আড়ালে অন্য ঠিকানা থাকতে পারে। ছোট লিংকে আসল গন্তব্য দেখা যায় না।"],steps:[
    ["Preview the full address; inspect the domain immediately before the final suffix.","পুরো ঠিকানা দেখুন; শেষাংশের ঠিক আগের মূল ডোমেইনটি পরীক্ষা করুন।"],
    ["Do not enter a password or payment details from an unsolicited message.","অনাকাঙ্ক্ষিত বার্তা থেকে খোলা পাতায় পাসওয়ার্ড বা পেমেন্ট তথ্য দেবেন না।"],
    ["If unsure, navigate to the official site yourself instead of following the link.","সন্দেহ হলে লিংক না খুলে নিজে অফিসিয়াল ওয়েবসাইটে যান।"]]},
  {category:"payments",icon:"🎁",title:["Treat unexpected prizes carefully","অপ্রত্যাশিত পুরস্কারের ব্যাপারে সতর্ক থাকুন"],summary:["A demand for a fee, tax, or bank details to release an unexpected prize is a reason to stop and verify.","অপ্রত্যাশিত পুরস্কার পেতে ফি, কর বা ব্যাংক তথ্য চাইলে থেমে যাচাই করুন।"],steps:[
    ["Ask yourself whether you entered that specific contest.","আপনি ওই নির্দিষ্ট প্রতিযোগিতায় অংশ নিয়েছিলেন কি না ভাবুন।"],
    ["Verify the promotion on the organization's official page.","প্রতিষ্ঠানের অফিসিয়াল পাতায় অফারটি যাচাই করুন।"],
    ["Never share an OTP or pay a stranger to release a prize.","পুরস্কার দেওয়ার নামে অপরিচিতকে ওটিপি দেবেন না বা টাকা পাঠাবেন না।"]]},
  {category:"account",icon:"🧾",title:["If you already paid or shared a code","ইতিমধ্যে টাকা বা কোড দিয়ে থাকলে"],summary:["Quick, calm action can reduce further loss. Keep useful evidence and contact the service provider.","দ্রুত ও শান্ত পদক্ষেপে আরও ক্ষতি কমানো যায়। দরকারি প্রমাণ রাখুন ও সেবাদাতার সঙ্গে যোগাযোগ করুন।"],steps:[
    ["Contact your bank or payment provider through its official app or known number.","অফিসিয়াল অ্যাপ বা জানা নম্বরে ব্যাংক/পেমেন্ট সেবাদাতাকে জানান।"],
    ["Change the affected password; sign out other sessions if the service supports it.","আক্রান্ত পাসওয়ার্ড বদলান; সুবিধা থাকলে অন্য সেশনগুলো থেকে সাইন আউট করুন।"],
    ["Save messages and transaction references. Do not delete evidence or send more money.","বার্তা ও লেনদেনের রেফারেন্স রাখুন। প্রমাণ মুছবেন না বা আরও টাকা দেবেন না।"]]},
];

const guideCopy = {
  es: [
    ["Nunca compartas OTP ni PIN","Tu banco y el soporte legítimo no necesitan tu código de un solo uso para revertir un pago o proteger una cuenta."],
    ["Verifica las alertas de cuenta por otra vía","Un aviso de cierre de cuenta puede intentar asustarte para que inicies sesión en una página falsa."],
    ["No te apresures ante pagos urgentes","Los estafadores inventan plazos o amenazas para que omitas las comprobaciones habituales."],
    ["Comprueba ofertas de empleo que piden dinero","Las tarifas iniciales de inscripción, formación o equipo pueden ser una señal de alerta."],
    ["Comprueba las tiendas en línea desconocidas","Una página cuidada o un candado no demuestra que el vendedor sea legítimo."],
    ["Revisa un enlace sin abrirlo","El nombre visible de una marca puede ocultar otro destino; los enlaces cortos ocultan a dónde llevan."],
    ["Desconfía de los premios inesperados","Si piden dinero o datos bancarios para entregar un premio, detente y verifica."],
    ["Si ya pagaste o compartiste un código","Actuar pronto y con calma puede reducir más pérdidas. Guarda pruebas y contacta con tu proveedor."],
  ],
  fr: [
    ["Ne partagez jamais un OTP ou un code PIN","Votre banque et un service d'assistance légitime n'ont pas besoin de votre code à usage unique."],
    ["Vérifiez les alertes de compte par un autre canal","Un avis de fermeture de compte peut vous pousser à vous connecter à une fausse page."],
    ["Ne vous précipitez pas pour un paiement urgent","Les fraudeurs inventent des délais ou des menaces pour vous faire oublier les vérifications."],
    ["Vérifiez les offres d'emploi qui demandent de l'argent","Des frais d'inscription, de formation ou d'équipement à payer d'avance sont un signal d'alerte."],
    ["Vérifiez les boutiques en ligne inconnues","Un site soigné ou un cadenas ne prouve pas que le vendeur est fiable."],
    ["Examinez un lien sans l'ouvrir","Une marque affichée peut masquer une autre destination ; les liens courts cachent leur cible."],
    ["Méfiez-vous des prix inattendus","Si des frais ou des coordonnées bancaires sont demandés, arrêtez-vous et vérifiez."],
    ["Si vous avez déjà payé ou partagé un code","Agir vite et calmement peut limiter les pertes. Gardez les preuves et contactez votre prestataire."],
  ],
  hi: [
    ["OTP या PIN कभी साझा न करें","भुगतान वापस करने या खाता सुरक्षित करने के लिए आपके बैंक को एक बार का कोड नहीं चाहिए।"],
    ["खाते की चेतावनी की अलग से पुष्टि करें","खाता बंद होने की चेतावनी आपको नकली पेज पर लॉग इन कराने की कोशिश हो सकती है।"],
    ["तत्काल भुगतान के दबाव में न आएँ","धोखेबाज़ सामान्य जाँच छोड़ने के लिए समय-सीमा या धमकी देते हैं।"],
    ["पैसे माँगने वाले नौकरी प्रस्ताव जाँचें","पहले से पंजीकरण, प्रशिक्षण या उपकरण शुल्क माँगना चेतावनी का संकेत हो सकता है।"],
    ["अपरिचित ऑनलाइन दुकान की जाँच करें","अच्छी वेबसाइट या ताले का चिह्न विक्रेता के असली होने का प्रमाण नहीं है।"],
    ["लिंक खोले बिना उसकी जाँच करें","दिख रहा ब्रांड नाम अलग गंतव्य छिपा सकता है; छोटे लिंक असली पता छिपाते हैं।"],
    ["अप्रत्याशित इनाम से सावधान रहें","इनाम देने के लिए शुल्क या बैंक विवरण माँगें तो रुकें और पुष्टि करें।"],
    ["यदि आपने पैसे दिए या कोड साझा किया","जल्दी और शांत कदम से आगे का नुकसान कम हो सकता है। सबूत रखें और सेवा प्रदाता से संपर्क करें।"],
  ],
  ar: [
    ["لا تشارك رمز OTP أو PIN أبداً","لا يحتاج البنك أو فريق الدعم الحقيقي إلى رمزك لمرة واحدة لإلغاء دفعة أو حماية حسابك."],
    ["تحقق من تنبيهات الحساب عبر قناة أخرى","قد يهدف إشعار إغلاق الحساب إلى إخافتك لتسجيل الدخول في صفحة مزيفة."],
    ["لا تتسرع بسبب طلب دفع عاجل","يختلق المحتالون مواعيد نهائية أو تهديدات لتجاوز الفحوصات المعتادة."],
    ["تحقق من عروض العمل التي تطلب المال","قد تكون رسوم التسجيل أو التدريب أو المعدات المدفوعة مسبقاً مؤشراً تحذيرياً."],
    ["تحقق من المتاجر الإلكترونية غير المعروفة","لا تثبت الصفحة المصقولة أو رمز القفل أن البائع موثوق."],
    ["افحص الرابط من دون فتحه","قد يخفي اسم العلامة التجارية وجهة مختلفة؛ كما تخفي الروابط المختصرة وجهتها."],
    ["توخ الحذر من الجوائز غير المتوقعة","إذا طُلبت رسوم أو بيانات مصرفية لاستلام جائزة، فتوقف وتحقق."],
    ["إذا أرسلت المال أو شاركت رمزاً","قد يقلل التصرف السريع والهادئ من الخسائر. احتفظ بالأدلة واتصل بمزود الخدمة."],
  ],
};

guideData.forEach((guide, index) => {
  for (const locale of ["es", "fr", "hi", "ar"]) {
    guide.title.push(guideCopy[locale][index][0]);
    guide.summary.push(guideCopy[locale][index][1]);
  }
});

const guideSteps = {
  es: {
    account: ["Cierra la llamada o el chat. Nunca compartas el código.", "Abre tú mismo la aplicación oficial y revisa la actividad.", "Si ya compartiste el código, contacta de inmediato con tu banco o proveedor."],
    payments: ["Detente y confirma la solicitud por un canal oficial independiente.", "Contacta con un número conocido; no confíes en el identificador de llamada.", "No pagues para desbloquear un empleo, premio o supuesto saldo."],
    shopping: ["Busca el nombre y la dirección exacta de la tienda, también posibles quejas.", "Comprueba la política de devoluciones, los datos de contacto y quién recibe el pago.", "Si no puedes verificar al vendedor, evita pagos irreversibles."],
  },
  fr: {
    account: ["Terminez l'appel ou la conversation. Ne partagez jamais le code.", "Ouvrez vous-même l'application officielle et vérifiez l'activité.", "Si vous avez partagé le code, contactez immédiatement votre banque ou prestataire."],
    payments: ["Arrêtez-vous et vérifiez la demande par un canal officiel indépendant.", "Appelez un numéro connu ; ne vous fiez pas à l'identifiant affiché.", "Ne payez pas pour débloquer un emploi, un prix ou un prétendu solde."],
    shopping: ["Recherchez le nom et l'adresse exacte du vendeur, y compris les avis.", "Vérifiez les retours, les coordonnées et le bénéficiaire du paiement.", "Si le vendeur n'est pas vérifiable, évitez les paiements irréversibles."],
  },
  hi: {
    account: ["कॉल या चैट बंद करें। कोड कभी साझा न करें।", "आधिकारिक ऐप स्वयं खोलें और हाल की गतिविधि देखें।", "कोड साझा किया है तो तुरंत बैंक या सेवा प्रदाता से संपर्क करें।"],
    payments: ["रुकें और अलग आधिकारिक माध्यम से अनुरोध की पुष्टि करें।", "पहचाने हुए नंबर पर संपर्क करें; कॉलर आईडी पर भरोसा न करें।", "नौकरी, इनाम या कथित कमाई पाने के लिए भुगतान न करें।"],
    shopping: ["दुकान का नाम और पूरा पता खोजें; शिकायतें भी देखें।", "वापसी नीति, संपर्क विवरण और भुगतान पाने वाले की जाँच करें।", "विक्रेता की पुष्टि न हो तो वापस न मिलने वाला भुगतान न करें।"],
  },
  ar: {
    account: ["أنه المكالمة أو المحادثة. لا تشارك الرمز أبداً.", "افتح التطبيق الرسمي بنفسك وراجع النشاط الأخير.", "إذا شاركت الرمز، فاتصل بالبنك أو مزود الخدمة فوراً."],
    payments: ["توقف وتحقق من الطلب عبر قناة رسمية مستقلة.", "اتصل برقم تعرفه؛ لا تعتمد على هوية المتصل الظاهرة.", "لا تدفع لفتح وظيفة أو جائزة أو رصيد مزعوم."],
    shopping: ["ابحث عن اسم المتجر وعنوانه الدقيق، بما في ذلك الشكاوى.", "قارن سياسة الإرجاع وبيانات الاتصال ومستلم الدفعة.", "إذا لم تستطع التحقق من البائع، فتجنب الدفع غير القابل للاسترداد."],
  },
};

const countryHelp = {
  us: {
    label: "countryUS",
    links: [{ label: "countryOrgFtc", url: "https://reportfraud.ftc.gov/" }],
  },
  canada: {
    label: "countryCanada",
    links: [{ label: "countryOrgCafc", url: "https://antifraudcentre-centreantifraude.ca/report-signalez-eng.htm" }],
  },
  india: {
    label: "countryIndia",
    links: [{ label: "countryOrgIndia", url: "https://cybercrime.gov.in/" }],
  },
  france: {
    label: "countryFrance",
    links: [{ label: "countryOrgFrance", url: "https://www.cybermalveillance.gouv.fr/" }],
  },
};

const quizQuestions = {
  en: [
    { prompt: "A caller says they are from your bank and asks for the one-time code sent to your phone. What is safest?", choices: ["Read the code so they can block the scam.", "End the call and contact the bank using its official app or a trusted number.", "Ask them to prove they know your account number."], answer: 1, explanation: "A one-time code can authorize account access or a payment. A real bank should not ask you to read it out." },
    { prompt: "A new employer asks you to pay a refundable registration fee before your first shift. What should you do?", choices: ["Pay if the offer letter looks official.", "Pause and independently verify the job; do not pay to unlock work.", "Send a small amount first as a test."], answer: 1, explanation: "Upfront fees for a job are a warning sign. Confirm the vacancy using contact details you find independently." },
    { prompt: "You entered your password on a page opened from an unexpected message. What is the best next step?", choices: ["Change it through the official site using a trusted device, then secure reused accounts.", "Wait to see whether anything happens.", "Reply to the message and ask if the page was genuine."], answer: 0, explanation: "Use the official app or website—not the message link—to change the password and review account sessions." },
  ],
  es: [
    { prompt: "Alguien dice que llama de tu banco y pide el código de un solo uso enviado a tu teléfono. ¿Qué es lo más seguro?", choices: ["Leer el código para que pueda bloquear la estafa.", "Terminar la llamada y contactar con el banco mediante su aplicación oficial o un número de confianza.", "Pedirle que demuestre que conoce tu número de cuenta."], answer: 1, explanation: "Un código de un solo uso puede autorizar el acceso a una cuenta o un pago. Un banco legítimo no debería pedirte que lo reveles." },
    { prompt: "Un nuevo empleador te pide una tarifa de inscripción reembolsable antes del primer turno. ¿Qué haces?", choices: ["Pagar si la oferta parece oficial.", "Detenerte y verificar el empleo por otra vía; no pagues para conseguir el trabajo.", "Enviar primero una cantidad pequeña."], answer: 1, explanation: "Las tarifas por adelantado para conseguir un empleo son una señal de alerta. Verifica la oferta con datos de contacto que encuentres por tu cuenta." },
    { prompt: "Introdujiste tu contraseña en una página abierta desde un mensaje inesperado. ¿Cuál es el mejor paso?", choices: ["Cambiarla en el sitio oficial desde un dispositivo de confianza y proteger las cuentas donde la reutilizaste.", "Esperar a ver si ocurre algo.", "Responder al mensaje y preguntar si la página era auténtica."], answer: 0, explanation: "Usa la aplicación o el sitio oficial, no el enlace del mensaje, para cambiar la contraseña y revisar las sesiones." },
  ],
  fr: [
    { prompt: "Une personne prétend appeler de votre banque et demande le code à usage unique reçu sur votre téléphone. Que faire ?", choices: ["Lire le code pour qu'elle bloque l'arnaque.", "Raccrocher et contacter la banque via son application officielle ou un numéro de confiance.", "Lui demander de prouver qu'elle connaît votre numéro de compte."], answer: 1, explanation: "Un code à usage unique peut autoriser l'accès à un compte ou un paiement. Une vraie banque ne devrait pas vous demander de le communiquer." },
    { prompt: "Un nouvel employeur demande des frais d'inscription remboursables avant votre premier jour. Que faire ?", choices: ["Payer si l'offre semble officielle.", "Faire une pause et vérifier l'emploi par un autre canal ; ne payez pas pour obtenir le poste.", "Envoyer d'abord une petite somme."], answer: 1, explanation: "Des frais à payer d'avance pour un emploi sont un signal d'alerte. Vérifiez l'offre avec des coordonnées trouvées indépendamment." },
    { prompt: "Vous avez saisi votre mot de passe sur une page ouverte depuis un message inattendu. Quelle est la meilleure étape ?", choices: ["Le changer via le site officiel depuis un appareil de confiance et sécuriser les comptes où il est réutilisé.", "Attendre de voir s'il se passe quelque chose.", "Répondre au message pour demander si la page était authentique."], answer: 0, explanation: "Utilisez l'application ou le site officiel, et non le lien du message, pour changer le mot de passe et vérifier les sessions." },
  ],
  hi: [
    { prompt: "कोई बैंक से होने का दावा करके फोन पर आया एक बार का कोड माँगता है। सबसे सुरक्षित कदम क्या है?", choices: ["कोड पढ़ दें ताकि वह धोखाधड़ी रोक सके।", "कॉल काटें और आधिकारिक ऐप या भरोसेमंद नंबर से बैंक से संपर्क करें।", "उससे खाता संख्या जानने का सबूत माँगें।"], answer: 1, explanation: "एक बार का कोड खाते या भुगतान को अधिकृत कर सकता है। असली बैंक को आपसे यह कोड नहीं माँगना चाहिए।" },
    { prompt: "नई नौकरी देने वाला पहले दिन से पहले वापस मिलने वाला पंजीकरण शुल्क माँगता है। क्या करें?", choices: ["ऑफ़र पत्र आधिकारिक लगे तो भुगतान करें।", "रुकें और नौकरी की अलग से पुष्टि करें; काम पाने के लिए भुगतान न करें।", "पहले थोड़ी रकम भेजकर देखें।"], answer: 1, explanation: "नौकरी के लिए अग्रिम शुल्क चेतावनी का संकेत है। खुद ढूँढे गए संपर्क विवरण से नौकरी की पुष्टि करें।" },
    { prompt: "अनजान संदेश के लिंक से खुले पेज पर आपने पासवर्ड डाल दिया। सबसे अच्छा अगला कदम क्या है?", choices: ["भरोसेमंद डिवाइस से आधिकारिक साइट पर पासवर्ड बदलें और जहाँ वही पासवर्ड है उन खातों को सुरक्षित करें।", "देखें कि आगे क्या होता है।", "संदेश का जवाब देकर पूछें कि पेज असली था या नहीं।"], answer: 0, explanation: "पासवर्ड बदलने और लॉगिन सत्र देखने के लिए संदेश के लिंक के बजाय आधिकारिक ऐप या साइट खोलें।" },
  ],
  ar: [
    { prompt: "يتصل شخص مدعياً أنه من البنك ويطلب الرمز لمرة واحدة الذي وصلك على هاتفك. ما التصرف الأكثر أماناً؟", choices: ["أخبره بالرمز ليوقف الاحتيال.", "أنه المكالمة واتصل بالبنك عبر تطبيقه الرسمي أو رقم موثوق.", "اطلب منه إثبات معرفته برقم حسابك."], answer: 1, explanation: "قد يسمح الرمز لمرة واحدة بالدخول إلى الحساب أو تأكيد دفعة. لا ينبغي للبنك الحقيقي أن يطلب منك إملاءه." },
    { prompt: "يطلب صاحب عمل جديد رسماً قابلاً للاسترداد للتسجيل قبل أول يوم عمل. ماذا تفعل؟", choices: ["ادفع إذا بدا خطاب العرض رسمياً.", "توقف وتحقق من الوظيفة عبر قناة مستقلة؛ لا تدفع للحصول على العمل.", "أرسل مبلغاً صغيراً أولاً."], answer: 1, explanation: "طلب رسوم مسبقة للحصول على وظيفة مؤشر تحذيري. تحقق من الشاغر عبر بيانات اتصال عثرت عليها بنفسك." },
    { prompt: "أدخلت كلمة مرورك في صفحة فتحتها من رسالة غير متوقعة. ما أفضل خطوة تالية؟", choices: ["غيّرها عبر الموقع الرسمي من جهاز موثوق وأمّن الحسابات التي تستخدم فيها كلمة المرور نفسها.", "انتظر لترى ما سيحدث.", "أجب عن الرسالة واسأل إن كانت الصفحة حقيقية."], answer: 0, explanation: "استخدم التطبيق أو الموقع الرسمي، لا رابط الرسالة، لتغيير كلمة المرور ومراجعة الجلسات." },
  ],
};

let quizIndex = -1;
let quizScore = 0;
let quizAnswered = false;

function setFeedback(element, message, kind = "") {
  element.textContent = message;
  element.className = `feedback${kind ? ` ${kind}` : ""}`;
  element.hidden = false;
}

function t(key) {
  return translations[currentLocale]?.[key] || translations.en[key] || key;
}

const localeSettings = {
  en: { index: 0, date: "en" },
  es: { index: 2, date: "es-ES" }, fr: { index: 3, date: "fr-FR" },
  hi: { index: 4, date: "hi-IN" }, ar: { index: 5, date: "ar" },
};

function localized(items) {
  return items[localeSettings[currentLocale].index] || items[0];
}

function renderResponsePlanner() {
  const select = $("#response-scenario");
  const selected = select.value || "code";
  select.replaceChildren();
  const scenarioLabels = {
    code: "responseScenarioCode",
    payment: "responseScenarioPayment",
    device: "responseScenarioDevice",
    link: "responseScenarioLink",
  };
  for (const [scenario, key] of Object.entries(scenarioLabels)) {
    const option = document.createElement("option");
    option.value = scenario;
    option.textContent = t(key);
    select.append(option);
  }
  select.value = Object.hasOwn(scenarioLabels, selected) ? selected : "code";
  const steps = $("#response-steps");
  steps.replaceChildren();
  const list = document.createElement("ol");
  for (const [index, text] of translations[currentLocale].plannerScenarios[select.value].steps.entries()) {
    const item = document.createElement("li");
    const number = document.createElement("span");
    number.className = "response-step-number";
    number.textContent = String(index + 1).padStart(2, "0");
    const copy = document.createElement("span");
    copy.textContent = text;
    item.append(number, copy);
    list.append(item);
  }
  steps.append(list);
}

function renderCountryHelp() {
  const select = $("#country-select");
  const selected = select.value || "us";
  select.replaceChildren();
  for (const [country, entry] of Object.entries(countryHelp)) {
    const option = document.createElement("option");
    option.value = country;
    option.textContent = t(entry.label);
    select.append(option);
  }
  select.value = Object.hasOwn(countryHelp, selected) ? selected : "us";
  const links = $("#country-help-links");
  links.replaceChildren();
  for (const entry of countryHelp[select.value].links) {
    const link = document.createElement("a");
    link.href = entry.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = t(entry.label);
    const action = document.createElement("span");
    action.textContent = t("countryLinkReport");
    const card = document.createElement("div");
    card.className = "country-help-link";
    card.append(link, action);
    links.append(card);
  }
}

function renderQuiz() {
  const content = $("#quiz-content");
  content.replaceChildren();
  const questions = quizQuestions[currentLocale];
  if (quizIndex < 0) {
    const start = document.createElement("button");
    start.type = "button";
    start.className = "primary-button";
    start.dataset.quizAction = "start";
    start.textContent = t("quizStart");
    content.append(start);
    return;
  }
  if (quizIndex >= questions.length) {
    const score = document.createElement("p");
    score.className = "quiz-result";
    score.textContent = t("quizScore").replace("{score}", String(quizScore)).replace("{total}", String(questions.length));
    const again = document.createElement("button");
    again.type = "button";
    again.className = "secondary-button";
    again.dataset.quizAction = "restart";
    again.textContent = t("quizAgain");
    content.append(score, again);
    return;
  }
  const question = questions[quizIndex];
  const title = document.createElement("p");
  title.className = "quiz-progress";
  title.textContent = `${t("quizQuestion")} ${quizIndex + 1} / ${questions.length}`;
  const prompt = document.createElement("p");
  prompt.className = "quiz-prompt";
  prompt.textContent = question.prompt;
  const choices = document.createElement("div");
  choices.className = "quiz-choices";
  question.choices.forEach((choice, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quiz-choice";
    button.textContent = choice;
    button.disabled = quizAnswered;
    if (quizAnswered && index === question.answer) button.classList.add("correct");
    if (quizAnswered && index === Number(content.dataset.selected) && index !== question.answer) button.classList.add("incorrect");
    button.addEventListener("click", () => {
      if (quizAnswered) return;
      content.dataset.selected = String(index);
      quizAnswered = true;
      if (index === question.answer) quizScore += 1;
      renderQuiz();
    });
    button.dataset.optionIndex = String(index);
    choices.append(button);
  });
  content.append(title, prompt, choices);
  if (quizAnswered) {
    const selectedAnswer = Number(content.dataset.selected);
    const feedback = document.createElement("p");
    feedback.className = `quiz-feedback ${selectedAnswer === question.answer ? "correct" : "incorrect"}`;
    feedback.textContent = `${t(selectedAnswer === question.answer ? "quizCorrect" : "quizIncorrect")} ${question.explanation}`;
    const next = document.createElement("button");
    next.type = "button";
    next.className = "primary-button quiz-next";
    next.dataset.quizAction = "next";
    next.textContent = t(quizIndex === questions.length - 1 ? "quizFinish" : "quizNext");
    content.append(feedback, next);
  }
}

function setupSafetyCenter() {
  $("#response-scenario").addEventListener("change", renderResponsePlanner);
  $("#country-select").addEventListener("change", renderCountryHelp);
  $("#quiz-content").addEventListener("click", (event) => {
    const button = event.target.closest("[data-quiz-action]");
    if (!button) return;
    if (button.dataset.quizAction === "start" || button.dataset.quizAction === "restart") {
      quizIndex = 0;
      quizScore = 0;
      quizAnswered = false;
      $("#quiz-content").dataset.selected = "";
    } else if (button.dataset.quizAction === "next") {
      quizIndex += 1;
      quizAnswered = false;
    }
    renderQuiz();
  });
  renderResponsePlanner();
  renderCountryHelp();
  renderQuiz();
}

function guideActions(guide) {
  return currentLocale === "en"
    ? guide.steps.map(localized)
    : guideSteps[currentLocale][guide.category];
}

function applyLocale() {
  document.documentElement.lang = currentLocale;
  document.documentElement.dir = currentLocale === "ar" ? "rtl" : "ltr";
  document.title = translations[currentLocale].pageTitle || translations.en.pageTitle;
  $$("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  $$("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  $$("[data-i18n-aria]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAria));
  });
  $("#language-select").value = currentLocale;
  if (lastResult) {
    lastResult = null;
    $("#result").hidden = true;
  }
  renderGuides();
  renderHistory();
  renderResponsePlanner();
  renderCountryHelp();
  renderQuiz();
}

function setupLanguage() {
  try {
    const savedLocale = window.localStorage.getItem("scamshield-locale");
    const browserLocale = (navigator.languages || [navigator.language || "en"])
      .map((language) => language.toLowerCase().split("-")[0])
      .find((language) => Object.hasOwn(localeSettings, language));
    currentLocale = Object.hasOwn(localeSettings, savedLocale) ? savedLocale : (browserLocale || "en");
  } catch {
    currentLocale = "en";
  }
  $("#language-select").addEventListener("change", (event) => {
    currentLocale = event.currentTarget.value;
    $("#guide-search").value = "";
    try {
      window.localStorage.setItem("scamshield-locale", currentLocale);
    } catch {
      // Language switching still works when storage is unavailable.
    }
    applyLocale();
  });
  applyLocale();
}

function setupGuides() {
  const search = $("#guide-search");
  search.addEventListener("input", renderGuides);
  const filters = $(".guide-filters");
  for (const category of ["all", "account", "payments", "shopping"]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "guide-filter";
    button.dataset.category = category;
    button.addEventListener("click", () => {
      guideCategory = category;
      renderGuides();
    });
    filters.append(button);
  }
  renderGuides();
}

function renderGuides() {
  const filters = $(".guide-filters");
  if (!filters) return;
  $$(".guide-filter", filters).forEach((button) => {
    button.textContent = t(`guide${button.dataset.category[0].toUpperCase()}${button.dataset.category.slice(1)}`);
    if (button.dataset.category === "payments") button.textContent = t("guidePayments");
    if (button.dataset.category === "shopping") button.textContent = t("guideShopping");
    button.classList.toggle("active", button.dataset.category === guideCategory);
    button.setAttribute("aria-pressed", String(button.dataset.category === guideCategory));
  });
  const query = $("#guide-search").value.trim().toLocaleLowerCase(currentLocale);
  const guides = guideData.filter((guide) => {
    const content = localized(guide.title) + " " + localized(guide.summary) + " " +
      guideActions(guide).join(" ");
    return (guideCategory === "all" || guide.category === guideCategory) &&
      content.toLocaleLowerCase(currentLocale).includes(query);
  });
  const grid = $("#guides-list");
  grid.replaceChildren();
  for (const guide of guides) {
    const details = document.createElement("details");
    details.className = "guide-card";
    const summary = document.createElement("summary");
    summary.className = "guide-summary";
    const icon = document.createElement("span");
    icon.className = "guide-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = guide.icon;
    const copy = document.createElement("span");
    copy.className = "guide-copy";
    const title = document.createElement("span");
    title.className = "guide-title";
    title.textContent = localized(guide.title);
    const excerpt = document.createElement("span");
    excerpt.className = "guide-excerpt";
    excerpt.textContent = localized(guide.summary);
    const arrow = document.createElement("span");
    arrow.className = "guide-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "⌄";
    copy.append(title, excerpt);
    summary.append(icon, copy, arrow);
    details.append(summary);
    const expanded = document.createElement("div");
    expanded.className = "guide-steps";
    const list = document.createElement("ol");
    for (const stepText of guideActions(guide)) {
      const step = document.createElement("li");
      step.textContent = stepText;
      list.append(step);
    }
    expanded.append(list);
    details.append(expanded);
    grid.append(details);
  }
  if (!guides.length) {
    const empty = document.createElement("p");
    empty.className = "guide-empty";
    empty.textContent = t("guidesNoMatch");
    grid.append(empty);
  }
}

async function request(path, options = {}) {
  const apiBase = window.SCAMSHIELD_API_BASE_URL || "";
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

function renderResult(result) {
  const target = $("#result");
  const names = {
    high_risk: "riskHigh",
    caution: "riskCaution",
    unknown: "riskUnknown",
    no_known_threat: "riskNoKnown",
    known_malicious: "riskKnown",
  };
  lastResult = result;
  target.dataset.risk = result.risk_label;
  target.replaceChildren();

  const header = document.createElement("div");
  header.className = "result-head";
  const icon = document.createElement("span");
  icon.className = "result-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = result.risk_label === "high_risk" || result.risk_label === "caution" ? "!" : "i";

  const heading = document.createElement("div");
  heading.className = "result-heading";
  const title = document.createElement("h3");
  title.textContent = result.title || t(names[result.risk_label] || "riskUnknown");
  const intro = document.createElement("p");
  intro.textContent = result.risk_label === "unknown"
    ? t("resultUnknown")
    : t("resultRisk");

  const scoreWrap = document.createElement("div");
  scoreWrap.className = "result-score-wrap";
  const scoreBadge = document.createElement("span");
  scoreBadge.className = "result-score-badge";
  const scoreValue = Number.isFinite(result.score) ? Math.min(Math.max(Number(result.score), 0), 100) : 0;
  scoreBadge.textContent = `${scoreValue}/100`;
  const meter = document.createElement("div");
  meter.className = "result-score-meter";
  const meterFill = document.createElement("span");
  meterFill.className = "result-score-fill";
  meterFill.style.width = `${scoreValue}%`;
  meter.append(meterFill);
  scoreWrap.append(scoreBadge, meter);

  heading.append(title, intro, scoreWrap);
  header.append(icon, heading);
  target.append(header);

  const evidenceHeading = document.createElement("h4");
  evidenceHeading.textContent = t("resultEvidence");
  target.append(evidenceHeading);
  const evidence = document.createElement("ul");
  evidence.className = "evidence-list";
  for (const item of result.evidence || []) {
    const li = document.createElement("li");
    li.textContent = item.text;
    evidence.append(li);
  }
  if (!evidence.children.length) {
    const li = document.createElement("li");
    li.textContent = t("resultNoEvidence");
    evidence.append(li);
  }
  target.append(evidence);

  if (result.detected_links?.length) {
    const links = document.createElement("p");
    links.className = "coverage";
    links.textContent = `${t("resultLinks")} ${result.detected_links.join(", ")}`;
    target.append(links);
  }
  const adviceHeading = document.createElement("h4");
  adviceHeading.textContent = t("resultNext");
  target.append(adviceHeading);
  const actions = document.createElement("ul");
  actions.className = "action-list";
  for (const action of result.recommended_actions || []) {
    const li = document.createElement("li");
    li.textContent = action;
    actions.append(li);
  }
  target.append(actions);

  const coverage = document.createElement("p");
  coverage.className = "coverage";
  coverage.textContent = t("resultCoverage");
  target.append(coverage);
  const disclaimer = document.createElement("p");
  disclaimer.className = "result-disclaimer";
  disclaimer.textContent = result.disclaimer || t("resultDisclaimer");
  target.append(disclaimer);
  target.hidden = false;
  target.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function sanitizeHistoryEntry(entry) {
  const riskLabels = ["high_risk", "caution", "unknown", "no_known_threat", "known_malicious"];
  if (!entry || !["url", "message"].includes(entry.type) ||
      !Object.hasOwn(localeSettings, entry.locale) ||
      !Number.isFinite(Date.parse(entry.checkedAt)) ||
      !entry.result || !riskLabels.includes(entry.result.risk_label)) {
    return null;
  }
  const strings = (items, limit) => Array.isArray(items)
    ? items.filter((item) => typeof item === "string").slice(0, limit).map((item) => item.slice(0, 1000))
    : [];
  return {
    type: entry.type,
    locale: entry.locale,
    checkedAt: entry.checkedAt,
    result: {
      risk_label: entry.result.risk_label,
      evidence: Array.isArray(entry.result.evidence)
        ? entry.result.evidence
          .filter((item) => item && typeof item.text === "string")
          .slice(0, 20)
          .map((item) => ({ text: item.text.slice(0, 1000) }))
        : [],
      recommended_actions: strings(entry.result.recommended_actions, 10),
      disclaimer: typeof entry.result.disclaimer === "string" ? entry.result.disclaimer.slice(0, 1000) : "",
    },
  };
}

function readCheckHistory() {
  const saved = window.localStorage.getItem(HISTORY_STORAGE_KEY);
  if (!saved) return [];
  const entries = JSON.parse(saved);
  if (!Array.isArray(entries)) throw new Error("Invalid check history");
  return entries.map(sanitizeHistoryEntry).filter(Boolean).slice(0, HISTORY_LIMIT);
}

function renderHistory() {
  const list = $("#check-history");
  const feedback = $("#history-feedback");
  if (!list || !feedback) return;
  list.replaceChildren();
  try {
    const entries = readCheckHistory();
    $("#history-clear").disabled = entries.length === 0;
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "history-empty";
      empty.textContent = t("historyEmpty");
      list.append(empty);
      feedback.hidden = true;
      return;
    }
    const riskKeys = {
      high_risk: "riskHigh", caution: "riskCaution", unknown: "riskUnknown",
      no_known_threat: "riskNoKnown", known_malicious: "riskKnown",
    };
    for (const [index, entry] of entries.entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "history-item";
      const label = document.createElement("span");
      label.className = "history-item-title";
      label.textContent = `${t(entry.type === "url" ? "historyTypeUrl" : "historyTypeMessage")} · ${t(riskKeys[entry.result.risk_label])}`;
      const metadata = document.createElement("span");
      metadata.className = "history-item-meta";
      const date = new Intl.DateTimeFormat(localeSettings[entry.locale].date, { dateStyle: "medium", timeStyle: "short" })
        .format(new Date(entry.checkedAt));
      const languageName = $("#language-select").options[[...$("#language-select").options].findIndex((option) => option.value === entry.locale)].textContent;
      metadata.textContent = `${date} · ${languageName}`;
      button.append(label, metadata);
      button.addEventListener("click", () => renderResult(entries[index].result));
      list.append(button);
    }
    feedback.hidden = true;
  } catch {
    $("#history-clear").disabled = false;
    const error = document.createElement("p");
    error.className = "history-empty";
    error.textContent = t("historyStorageError");
    list.append(error);
    setFeedback(feedback, t("historyStorageError"), "error");
  }
}

function saveCheckHistory(result, valueKey) {
  try {
    const entries = readCheckHistory();
    entries.unshift({
      type: valueKey === "url" ? "url" : "message",
      locale: currentLocale,
      checkedAt: new Date().toISOString(),
      result: {
        risk_label: result.risk_label,
        evidence: (result.evidence || []).map((item) => ({ text: item.text })),
        recommended_actions: result.recommended_actions || [],
        disclaimer: result.disclaimer || "",
      },
    });
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, HISTORY_LIMIT)));
    setFeedback($("#history-feedback"), "", "");
    renderHistory();
  } catch {
    setFeedback($("#history-feedback"), t("historyStorageError"), "error");
  }
}

function setupHistory() {
  $("#history-clear").addEventListener("click", () => {
    try {
      window.localStorage.removeItem(HISTORY_STORAGE_KEY);
      renderHistory();
      setFeedback($("#history-feedback"), t("historyCleared"), "success");
    } catch {
      setFeedback($("#history-feedback"), t("historyStorageError"), "error");
    }
  });
  renderHistory();
}

function readableError(error) {
  const errorKeys = {
    "Choose a listed report category.": "errorCategory",
    "Add a little more detail (at least 12 characters).": "errorSummary",
    "No report was found for that reference.": "errorReportNotFound",
    "Failed to fetch": "errorNetwork",
    "The request could not be completed.": "errorNetwork",
  };
  return errorKeys[error.message] ? t(errorKeys[error.message]) : (error.message || t("errorNetwork"));
}

function setupTabs() {
  const tabs = $$(".tab");
  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      for (const other of tabs) {
        const selected = other === tab;
        other.classList.toggle("active", selected);
        other.setAttribute("aria-selected", String(selected));
        $(`#${other.getAttribute("aria-controls")}`).hidden = !selected;
      }
      $("#check-feedback").hidden = true;
      $("#result").hidden = true;
    });
  }
}

function setupScreenshotForm() {
  const form = $("#screenshot-form");
  const fileInput = $("#screenshot-file");
  const previewWrap = $("#screenshot-preview-wrap");
  const preview = $("#screenshot-preview");
  const textInput = $("#screenshot-text");
  const feedback = $("#check-feedback");

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFeedback(feedback, "Please choose an image file for the screenshot check.", "error");
      return;
    }
    previewWrap.hidden = false;
    preview.src = URL.createObjectURL(file);
    if (window.Tesseract) {
      try {
        const result = await window.Tesseract.recognize(file, "eng");
        if (result?.data?.text) {
          textInput.value = result.data.text.trim();
          setFeedback(feedback, "Screenshot text captured. Review it before analyzing.", "success");
        }
      } catch {
        setFeedback(feedback, "OCR could not read the screenshot. Paste the text manually instead.", "error");
      }
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = $("#result");
    const button = $("button[type=submit]", form);
    result.hidden = true;
    setFeedback(feedback, t("checking"), "");
    button.disabled = true;
    try {
      const payload = await request("/api/check/screenshot", {
        method: "POST",
        body: JSON.stringify({ text: textInput.value.trim(), locale: currentLocale }),
      });
      feedback.hidden = true;
      renderResult(payload);
      saveCheckHistory(payload, "message");
    } catch (error) {
      setFeedback(feedback, readableError(error), "error");
    } finally {
      button.disabled = false;
    }
  });
}

function isLikelyUrl(value) {
  const text = value.trim();
  return /^https?:\/\//i.test(text) || /^www\./i.test(text) || /^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(text);
}

function decodeQrFromImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Could not decode QR image."));
          return;
        }
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const code = window.jsQR ? window.jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height) : null;
        if (!code || !code.data) {
          reject(new Error("No QR code was found in that image."));
          return;
        }
        resolve(code.data.trim());
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error("The QR image could not be read."));
    image.src = URL.createObjectURL(file);
  });
}

function stopVideoStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

function setupQrForm() {
  const form = $("#qr-form");
  const fileInput = $("#qr-file");
  const cameraButton = $("#qr-camera-button");
  const videoWrap = $("#qr-video-wrap");
  const video = $("#qr-video");
  const textInput = $("#qr-text");
  const feedback = $("#check-feedback");
  let cameraStream = null;
  let scanTimer = null;

  const stopCamera = () => {
    if (scanTimer) clearInterval(scanTimer);
    stopVideoStream(cameraStream);
    cameraStream = null;
    videoWrap.hidden = true;
    if (video.srcObject) {
      video.srcObject = null;
    }
  };

  const decodeCameraFrame = async () => {
    if (!video.videoWidth || !video.videoHeight || !window.jsQR) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const result = window.jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
    if (!result || !result.data) return;
    textInput.value = result.data.trim();
    stopCamera();
    setFeedback(feedback, "QR code decoded successfully. Review the value before analyzing.", "success");
  };

  cameraButton.addEventListener("click", async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setFeedback(feedback, "Your browser does not support camera scanning. Please upload a QR image instead.", "error");
      return;
    }
    try {
      stopCamera();
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      video.srcObject = cameraStream;
      await video.play();
      videoWrap.hidden = false;
      setFeedback(feedback, "Camera ready. Hold the QR code still to scan it.", "success");
      scanTimer = setInterval(decodeCameraFrame, 600);
    } catch {
      setFeedback(feedback, "Camera access was denied. Please upload a QR image instead.", "error");
      stopCamera();
    }
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    stopCamera();
    try {
      const decoded = await decodeQrFromImage(file);
      textInput.value = decoded;
      setFeedback(feedback, "QR code decoded successfully. Review the value before analyzing.", "success");
    } catch (error) {
      setFeedback(feedback, error.message || "No QR code was found in that image.", "error");
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = textInput.value.trim();
    const result = $("#result");
    const button = $("button[type=submit]", form);
    result.hidden = true;
    setFeedback(feedback, t("checking"), "");
    button.disabled = true;
    try {
      if (!value) throw new Error("Paste or scan a QR code value before analyzing it.");
      const payload = isLikelyUrl(value)
        ? await request("/api/check/url", { method: "POST", body: JSON.stringify({ url: value, locale: currentLocale }) })
        : await request("/api/check/message", { method: "POST", body: JSON.stringify({ text: value, locale: currentLocale }) });
      feedback.hidden = true;
      renderResult(payload);
      saveCheckHistory(payload, isLikelyUrl(value) ? "url" : "message");
    } catch (error) {
      setFeedback(feedback, readableError(error), "error");
    } finally {
      button.disabled = false;
    }
  });
}

function setupCheckForm(formId, path, valueKey) {
  $(formId).addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = $("#check-feedback");
    const result = $("#result");
    result.hidden = true;
    feedback.hidden = false;
    feedback.className = "feedback";
    feedback.textContent = t("checking");
    const submit = $("button[type=submit]", form);
    submit.disabled = true;
    try {
      const body = await request(path, { method: "POST", body: JSON.stringify({ [valueKey]: $(`[name="${valueKey}"]`, form).value, locale: currentLocale }) });
      feedback.hidden = true;
      renderResult(body);
      saveCheckHistory(body, valueKey);
    } catch (error) {
      setFeedback(feedback, readableError(error), "error");
    } finally {
      submit.disabled = false;
    }
  });
}

function setupReport() {
  $("#report-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = $("#report-feedback");
    const button = $("button[type=submit]", form);
    button.disabled = true;
    setFeedback(feedback, t("sending"));
    const data = Object.fromEntries(new FormData(form));
    try {
      const result = await request("/api/reports", { method: "POST", body: JSON.stringify(data) });
      form.reset();
      setFeedback(feedback, `${t("reportSuccess")} ${result.reference}`, "success");
    } catch (error) {
      setFeedback(feedback, readableError(error), "error");
    } finally {
      button.disabled = false;
    }
  });
}

function setupStatus() {
  $("#status-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const feedback = $("#status-feedback");
    setFeedback(feedback, t("statusLoading"));
    try {
      const result = await request("/api/reports/status", {
        method: "POST",
        body: JSON.stringify({ token: $("#status-token").value.trim(), locale: currentLocale }),
      });
      const statusKeys = { pending: "statusPending", verified: "statusVerified", rejected: "statusRejected", escalated: "statusEscalated" };
      const statusName = t(statusKeys[result.status] || "statusPending");
      const date = new Intl.DateTimeFormat(localeSettings[currentLocale].date, { dateStyle: "medium", timeStyle: "short" }).format(new Date(result.updated_at));
      setFeedback(feedback, `${t("statusResult")} ${statusName}. ${t("lastUpdated")} ${date}.`, "success");
    } catch (error) {
      setFeedback(feedback, readableError(error), "error");
    }
  });
}

function renderQueue(reports) {
  const queue = $("#admin-queue");
  queue.replaceChildren();
  if (!reports.length) {
    const empty = document.createElement("p");
    empty.className = "feedback";
    empty.textContent = t("queueEmpty");
    queue.append(empty);
    return;
  }
  for (const report of reports) {
    const item = document.createElement("article");
    item.className = "admin-item";
    const title = document.createElement("h3");
    const categoryKeys = { fake_shop: "categoryShop", job: "categoryJob", payment: "categoryPayment", impersonation: "categoryImpersonation", account: "categoryAccount", other: "categoryOther" };
    const date = new Intl.DateTimeFormat(localeSettings[currentLocale].date, { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.created_at));
    title.textContent = `${t(categoryKeys[report.category] || "categoryOther")} · ${date}`;
    const target = document.createElement("p");
    target.textContent = `${t("target")} ${report.target}`;
    const summary = document.createElement("p");
    summary.textContent = report.summary;
    const actions = document.createElement("div");
    actions.className = "admin-actions";
    for (const [status, labelKey] of [["verified", "statusVerified"], ["rejected", "statusRejected"], ["escalated", "statusEscalated"]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = t(labelKey);
      button.addEventListener("click", () => reviewReport(report.id, status));
      actions.append(button);
    }
    item.append(title, target, summary, actions);
    queue.append(item);
  }
}

async function loadQueue(feedback) {
  const result = await request("/api/admin/reports", { headers: { Authorization: `Bearer ${adminToken}` } });
  renderQueue(result.reports);
  setFeedback(feedback, `${result.reports.length} ${t("pendingCount")}`, "success");
}

async function reviewReport(id, status) {
  const feedback = $("#admin-feedback");
  try {
    const statusKey = { verified: "statusVerified", rejected: "statusRejected", escalated: "statusEscalated" }[status];
    const reason = window.prompt(`${t("promptReason")} ${t(statusKey)}:`);
    if (!reason?.trim()) return;
    await request(`/api/admin/reports/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status, reason: reason.trim() }),
    });
    await loadQueue(feedback);
  } catch (error) {
    setFeedback(feedback, readableError(error), "error");
  }
}

function setupAdmin() {
  $("#admin-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const feedback = $("#admin-feedback");
    adminToken = $("#admin-token").value;
    try {
      await loadQueue(feedback);
    } catch (error) {
      adminToken = "";
      setFeedback(feedback, readableError(error), "error");
    }
  });
}

setupLanguage();
setupGuides();
setupHistory();
setupSafetyCenter();
setupTabs();
setupCheckForm("#url-form", "/api/check/url", "url");
setupCheckForm("#message-form", "/api/check/message", "text");
setupScreenshotForm();
setupQrForm();
setupReport();
setupStatus();

function setupMainNavigation() {
  const links = $$(".main-nav a");
  if (!links.length) return;

  const updateCurrentLink = () => {
    const activeHash = window.location.hash || links[0].getAttribute("href");
    for (const link of links) {
      if (link.getAttribute("href") === activeHash) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    }
  };

  updateCurrentLink();
  window.addEventListener("hashchange", updateCurrentLink);
}

setupMainNavigation();

(() => {
  const animatedElements = [...document.querySelectorAll(".hero .appear")];
  if (!animatedElements.length) return;

  for (const element of animatedElements) {
    element.addEventListener("animationend", () => element.classList.add("is-in"), { once: true });
  }

  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const element of animatedElements) {
      const hasRunningAnimation = element.getAnimations().some(
        (animation) => animation.playState === "running",
      );
      if (!hasRunningAnimation) element.classList.add("is-in");
    }
  }));
})();
