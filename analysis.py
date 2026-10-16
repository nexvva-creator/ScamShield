from __future__ import annotations

import re
from datetime import datetime, timezone
from ipaddress import ip_address
from urllib.parse import urlsplit


RULESET_VERSION = "local-rules-1"
SUPPORTED_LOCALES = ("en", "es", "fr", "hi", "ar", "bn")
URL_PATTERN = re.compile(r"(?i)\b(?:https?://|www\.)[^\s<>\]\[\"']+")
SHORTENERS = {"bit.ly", "t.co", "tinyurl.com", "is.gd", "cutt.ly", "rb.gy", "shorturl.at"}
RISKY_TLDS = {".zip", ".mov", ".click", ".top", ".xyz"}
BN = {
    "The message asks for a password, PIN, OTP, or verification code.": "বার্তাটিতে পাসওয়ার্ড, পিন, ওটিপি বা যাচাইকরণ কোড চাওয়া হয়েছে।",
    "The message uses urgency or a threat to push a quick response.": "দ্রুত সিদ্ধান্ত নিতে বার্তাটিতে চাপ বা হুমকি দেওয়া হয়েছে।",
    "The message asks for an upfront or unexpected fee.": "বার্তাটিতে আগাম বা অপ্রত্যাশিত ফি চাওয়া হয়েছে।",
    "The message promises an unexpected prize or gift.": "বার্তাটিতে অপ্রত্যাশিত পুরস্কার বা উপহারের প্রতিশ্রুতি দেওয়া হয়েছে।",
    "The message pushes you to click a link or verify an account.": "বার্তাটিতে লিংকে ক্লিক করতে বা অ্যাকাউন্ট যাচাই করতে বলা হয়েছে।",
    "The message promises unusually certain or high returns.": "বার্তাটিতে অস্বাভাবিক নিশ্চিত বা বেশি লাভের প্রতিশ্রুতি দেওয়া হয়েছে।",
    "The message contains a web link; check its destination independently before opening it.": "বার্তাটিতে ওয়েব লিংক রয়েছে; খোলার আগে আলাদাভাবে গন্তব্য যাচাই করুন।",
    "The message asks for sensitive identity information; verify the request independently.": "বার্তাটিতে পরিচয়সংক্রান্ত সংবেদনশীল তথ্য চাওয়া হয়েছে; অন্যভাবে অনুরোধটি যাচাই করুন।",
    "asks for a password, PIN, OTP, or verification code.": "বার্তাটিতে পাসওয়ার্ড, পিন, ওটিপি বা যাচাইকরণ কোড চাওয়া হয়েছে।",
    "uses urgency or a threat to push a quick response.": "দ্রুত সিদ্ধান্ত নিতে চাপ বা হুমকি দেওয়া হয়েছে।",
    "asks for an upfront or unexpected fee.": "আগাম বা অপ্রত্যাশিত ফি চাওয়া হয়েছে।",
    "promises an unexpected prize or gift.": "অপ্রত্যাশিত পুরস্কার বা উপহারের প্রতিশ্রুতি দেওয়া হয়েছে।",
    "pushes you to click a link or verify an account.": "লিংকে ক্লিক করতে বা অ্যাকাউন্ট যাচাই করতে বলা হয়েছে।",
    "promises unusually certain or high returns.": "অস্বাভাবিক নিশ্চিত বা বেশি লাভের প্রতিশ্রুতি দেওয়া হয়েছে।",
    "The message promises a job or easy income without enough verifiable detail.": "যাচাইযোগ্য তথ্য ছাড়াই বার্তাটিতে চাকরি বা সহজ আয়ের প্রতিশ্রুতি দেওয়া হয়েছে।",
    "The domain contains non-ASCII characters; check carefully for lookalike letters.": "ডোমেইনে ASCII-বহির্ভূত অক্ষর আছে; দেখতে একই রকম অক্ষর আছে কি না ভালো করে যাচাই করুন।",
    "A hostname label contains an unusually dense sequence of digits.": "হোস্টনেমের একটি অংশে অস্বাভাবিকভাবে অনেক সংখ্যার ধারাবাহিকতা আছে।",
    "The address contains encoded separators or punctuation that can obscure its path.": "ঠিকানায় এনকোড করা বিভাজক বা বিরামচিহ্ন রয়েছে যা পথ আড়াল করতে পারে।",
    "The link contains a numeric IP address instead of a familiar domain name.": "লিংকটিতে পরিচিত ডোমেইনের বদলে সংখ্যাভিত্তিক আইপি ঠিকানা রয়েছে।",
    "The link uses a numeric IP address instead of a familiar domain name.": "লিংকটিতে পরিচিত ডোমেইনের বদলে সংখ্যাভিত্তিক আইপি ঠিকানা রয়েছে।",
    "The domain uses encoded characters that can be used to imitate another name.": "ডোমেইনে অন্য নামের অনুকরণে ব্যবহারযোগ্য এনকোড করা অক্ষর রয়েছে।",
    "The address has several nested subdomains; check the actual registered domain carefully.": "ঠিকানাটিতে অনেকগুলো সাবডোমেইন রয়েছে; মূল ডোমেইনটি ভালো করে যাচাই করুন।",
    "A URL-shortening service hides the final destination.": "ইউআরএল সংক্ষিপ্ত করার সেবা আসল গন্তব্যটি আড়াল করছে।",
    "The domain uses a suffix that is also seen in some deceptive links; this alone does not prove a scam.": "ডোমেইনের শেষাংশ কিছু প্রতারণামূলক লিংকেও দেখা যায়; শুধু এটুকু দিয়ে প্রতারণা প্রমাণ হয় না।",
    "The link does not use HTTPS, so its connection is not encrypted.": "লিংকটি HTTPS ব্যবহার করে না, তাই সংযোগটি এনক্রিপ্ট করা নয়।",
    "The link uses a non-standard web port.": "লিংকটি ওয়েবের অপ্রচলিত পোর্ট ব্যবহার করছে।",
    "High risk indicators": "উচ্চ ঝুঁকির লক্ষণ",
    "Pause and verify": "থামুন এবং যাচাই করুন",
    "Unable to determine": "নিশ্চিতভাবে নির্ধারণ করা যায়নি",
    "No strong signal was found by the local rules.": "স্থানীয় নিয়মে শক্তিশালী কোনো সংকেত পাওয়া যায়নি।",
    "The message asks for a password, PIN, OTP, or verification code.": "বার্তাটিতে পাসওয়ার্ড, পিন, ওটিপি বা যাচাইকরণ কোড চাওয়া হয়েছে।",
    "The message uses urgency or a threat to push a quick response.": "দ্রুত উত্তর দিতে বার্তাটিতে তাড়াহুড়ো বা হুমকি ব্যবহার করা হয়েছে।",
    "The message asks for an upfront or unexpected fee.": "বার্তাটিতে আগাম বা অপ্রত্যাশিত ফি চাওয়া হয়েছে।",
    "The message promises an unexpected prize or gift.": "বার্তাটিতে অপ্রত্যাশিত পুরস্কার বা উপহারের প্রতিশ্রুতি দেওয়া হয়েছে।",
    "The message pushes you to click a link or verify an account.": "বার্তাটিতে লিংকে ক্লিক করতে বা অ্যাকাউন্ট যাচাই করতে চাপ দেওয়া হয়েছে।",
    "The message promises unusually certain or high returns.": "বার্তাটিতে অস্বাভাবিক নিশ্চিত বা বেশি লাভের প্রতিশ্রুতি দেওয়া হয়েছে।",
    "Do not open the link or send money.": "লিংক খুলবেন না বা টাকা পাঠাবেন না।",
    "Do not share passwords, PINs, or verification codes.": "পাসওয়ার্ড, পিন বা যাচাইকরণ কোড কাউকে দেবেন না।",
    "Check the request through the organization's official app or website.": "প্রতিষ্ঠানটির অফিসিয়াল অ্যাপ বা ওয়েবসাইটে অনুরোধটি যাচাই করুন।",
    "Never share a PIN, password, or one-time code.": "পিন, পাসওয়ার্ড বা একবার ব্যবহারযোগ্য কোড কখনো শেয়ার করবেন না।",
    "No live threat-list check is configured.": "কোনো লাইভ হুমকি-তালিকা পরীক্ষা চালু নেই।",
    "No strong local-rule signal was found, but no live threat-list check is configured.": "স্থানীয় নিয়মে শক্তিশালী সংকেত পাওয়া যায়নি এবং কোনো লাইভ হুমকি-তালিকা পরীক্ষা চালু নেই।",
    "Verify the sender independently before sharing information or paying.": "তথ্য দেওয়া বা টাকা পাঠানোর আগে অন্য মাধ্যমে প্রেরককে যাচাই করুন।",
    "This is decision-support guidance, not a guarantee. No live threat-intelligence provider is configured.": "এটি সিদ্ধান্ত নিতে সহায়ক পরামর্শ, নিশ্চয়তা নয়। কোনো লাইভ হুমকি-তথ্য সেবা সংযুক্ত নেই।",
    "Your message is analyzed in memory and is not saved or sent to an external service.": "আপনার বার্তা মেমরিতে বিশ্লেষণ করা হয়; সংরক্ষণ বা বাইরের সেবায় পাঠানো হয় না।",
    "The message contains a web link; check its destination independently before opening it.": "বার্তাটিতে ওয়েব লিংক রয়েছে; খোলার আগে আলাদাভাবে গন্তব্য যাচাই করুন।",
    "No strong local-rule signal was found.": "স্থানীয় নিয়মে জোরালো কোনো সংকেত পাওয়া যায়নি।",
    "No strong signal was found by the local rules.": "স্থানীয় নিয়মে জোরালো কোনো সংকেত পাওয়া যায়নি।",
    "High risk indicators": "উচ্চ ঝুঁকির সংকেত",
    "Pause and verify": "থামুন এবং যাচাই করুন",
    "Unable to determine": "নিশ্চিত হওয়া যায়নি",
    "Do not open the link or send money.": "লিংকটি খুলবেন না বা টাকা পাঠাবেন না।",
    "Do not share passwords, PINs, or verification codes.": "পাসওয়ার্ড, পিন বা যাচাইকরণ কোড কাউকে দেবেন না।",
    "Contact the organization using a number or website you already trust.": "আগে থেকে জানা বিশ্বস্ত নম্বর বা ওয়েবসাইটে প্রতিষ্ঠানের সঙ্গে যোগাযোগ করুন।",
    "Do not use contact details or links in the message.": "বার্তার ভেতরের যোগাযোগের তথ্য বা লিংক ব্যবহার করবেন না।",
    "Check the request through the organization's official app or website.": "প্রতিষ্ঠানের অফিসিয়াল অ্যাপ বা ওয়েবসাইটে অনুরোধটি যাচাই করুন।",
    "Never share a PIN, password, or one-time code.": "পিন, পাসওয়ার্ড, ওটিপি বা ওয়ান-টাইম কোড কাউকে দেবেন না।",
    "No strong local-rule signal was found, but no live threat-list check is configured.": "স্থানীয় নিয়মে জোরালো সংকেত মেলেনি; তবে লাইভ হুমকি-তালিকা যাচাই চালু নেই।",
    "No live threat-list check is configured.": "লাইভ হুমকি-তালিকা যাচাই চালু নেই।",
    "Verify the sender independently before sharing information or paying.": "তথ্য দেওয়া বা টাকা পাঠানোর আগে অন্য কোনো বিশ্বস্ত মাধ্যমে প্রেরককে যাচাই করুন।",
    "This is decision-support guidance, not a guarantee. No live threat-intelligence provider is configured.": "এটি সিদ্ধান্ত নিতে সহায়ক পরামর্শ, নিশ্চয়তা নয়। কোনো লাইভ হুমকি-তথ্য সেবা যুক্ত নেই।",
    "Your message is analyzed in memory and is not saved or sent to an external service.": "আপনার বার্তা শুধু মেমোরিতে বিশ্লেষণ করা হয়; সংরক্ষণ বা বাইরের কোনো সেবায় পাঠানো হয় না।",
}
BN.update({
    "Enter one complete URL without spaces.": "স্পেস ছাড়া একটি সম্পূর্ণ ওয়েব ঠিকানা লিখুন।",
    "That does not look like a valid web address.": "এটি সঠিক ওয়েব ঠিকানা বলে মনে হচ্ছে না।",
    "Enter a web address using HTTP or HTTPS; links with embedded credentials are not accepted.": "HTTP বা HTTPS দিয়ে শুরু হওয়া ঠিকানা লিখুন; ঠিকানার মধ্যে লগইন তথ্য থাকলে তা গ্রহণ করা হবে না।",
    "Local network addresses cannot be checked.": "স্থানীয় নেটওয়ার্কের ঠিকানা পরীক্ষা করা যাবে না।",
    "Private or reserved IP addresses cannot be checked.": "ব্যক্তিগত বা সংরক্ষিত আইপি ঠিকানা পরীক্ষা করা যাবে না।",
    "The web address contains an invalid port.": "ওয়েব ঠিকানায় ভুল পোর্ট নম্বর রয়েছে।",
    "Paste a message with at least 3 characters.": "কমপক্ষে ৩ অক্ষরের বার্তা পেস্ট করুন।",
    "The message is too long (maximum 6,000 characters).": "বার্তাটি অনেক বড় (সর্বোচ্চ ৬,০০০ অক্ষর)।",
})
RESULT_TRANSLATIONS = {
    "es": {
        "The message asks for a password, PIN, OTP, or verification code.": "El mensaje solicita una contraseña, PIN, OTP o código de verificación.",
        "The message uses urgency or a threat to push a quick response.": "El mensaje usa urgencia o amenazas para presionarte a responder rápido.",
        "The message asks for an upfront or unexpected fee.": "El mensaje solicita un pago por adelantado o una tarifa inesperada.",
        "The message promises an unexpected prize or gift.": "El mensaje promete un premio o regalo inesperado.",
        "The message pushes you to click a link or verify an account.": "El mensaje te presiona para abrir un enlace o verificar una cuenta.",
        "The message promises unusually certain or high returns.": "El mensaje promete ganancias inusualmente altas o garantizadas.",
        "The message promises a job or easy income without enough verifiable detail.": "El mensaje promete empleo o ingresos fáciles sin suficientes datos verificables.",
        "The message asks for sensitive identity information; verify the request independently.": "El mensaje solicita datos personales sensibles; verifica la solicitud por otra vía.",
        "The message contains a web link; check its destination independently before opening it.": "El mensaje incluye un enlace; comprueba su destino por otra vía antes de abrirlo.",
        "The link uses a numeric IP address instead of a familiar domain name.": "El enlace usa una dirección IP numérica en lugar de un dominio conocido.",
        "The domain uses encoded characters that can be used to imitate another name.": "El dominio usa caracteres codificados que podrían imitar otro nombre.",
        "The address has several nested subdomains; check the actual registered domain carefully.": "La dirección tiene varios subdominios; revisa con cuidado el dominio principal.",
        "A URL-shortening service hides the final destination.": "Un acortador de URL oculta el destino final.",
        "The domain uses a suffix that is also seen in some deceptive links; this alone does not prove a scam.": "El dominio usa un sufijo visto en algunos enlaces engañosos; esto por sí solo no demuestra fraude.",
        "The link does not use HTTPS, so its connection is not encrypted.": "El enlace no usa HTTPS, por lo que la conexión no está cifrada.",
        "The link uses a non-standard web port.": "El enlace usa un puerto web no habitual.",
        "No strong signal was found by the local rules.": "Las reglas locales no detectaron indicios claros.",
        "High risk indicators": "Indicios de riesgo alto",
        "Pause and verify": "Detente y verifica",
        "Unable to determine": "No se pudo determinar",
        "Do not open the link or send money.": "No abras el enlace ni envíes dinero.",
        "Do not share passwords, PINs, or verification codes.": "No compartas contraseñas, PIN ni códigos de verificación.",
        "Contact the organization using a number or website you already trust.": "Contacta con la organización mediante un número o sitio web de confianza que ya conozcas.",
        "Do not use contact details or links in the message.": "No uses los datos de contacto ni los enlaces del mensaje.",
        "Check the request through the organization's official app or website.": "Comprueba la solicitud en la aplicación o sitio web oficial de la organización.",
        "Never share a PIN, password, or one-time code.": "Nunca compartas un PIN, contraseña o código de un solo uso.",
        "No strong local-rule signal was found, but no live threat-list check is configured.": "Las reglas locales no detectaron indicios claros, pero no hay una consulta activa a listas de amenazas.",
        "No live threat-list check is configured.": "No hay una consulta activa a listas de amenazas.",
        "Verify the sender independently before sharing information or paying.": "Verifica al remitente por otra vía antes de compartir datos o pagar.",
        "This is decision-support guidance, not a guarantee. No live threat-intelligence provider is configured.": "Esta orientación ayuda a decidir, pero no es una garantía. No hay un servicio activo de inteligencia de amenazas.",
        "Your message is analyzed in memory and is not saved or sent to an external service.": "El mensaje se analiza en memoria; no se guarda ni se envía a servicios externos.",
        "Enter one complete URL without spaces.": "Introduce una URL completa sin espacios.",
        "That does not look like a valid web address.": "La dirección web no parece válida.",
        "Enter a web address using HTTP or HTTPS; links with embedded credentials are not accepted.": "Introduce una dirección HTTP o HTTPS; no se aceptan enlaces con credenciales.",
        "Local network addresses cannot be checked.": "No se pueden comprobar direcciones de redes locales.",
        "Private or reserved IP addresses cannot be checked.": "No se pueden comprobar direcciones IP privadas o reservadas.",
        "The web address contains an invalid port.": "La dirección web contiene un puerto no válido.",
        "Paste a message with at least 3 characters.": "Pega un mensaje de al menos 3 caracteres.",
        "The message is too long (maximum 6,000 characters).": "El mensaje es demasiado largo (máximo 6.000 caracteres).",
    },
    "fr": {
        "The message asks for a password, PIN, OTP, or verification code.": "Le message demande un mot de passe, un code PIN, un OTP ou un code de vérification.",
        "The message uses urgency or a threat to push a quick response.": "Le message utilise l'urgence ou une menace pour vous pousser à répondre rapidement.",
        "The message asks for an upfront or unexpected fee.": "Le message demande des frais à l'avance ou inattendus.",
        "The message promises an unexpected prize or gift.": "Le message promet un prix ou un cadeau inattendu.",
        "The message pushes you to click a link or verify an account.": "Le message vous incite à cliquer sur un lien ou à vérifier un compte.",
        "The message promises unusually certain or high returns.": "Le message promet des gains exceptionnellement élevés ou garantis.",
        "The message promises a job or easy income without enough verifiable detail.": "Le message promet un emploi ou des revenus faciles sans détails vérifiables suffisants.",
        "The message asks for sensitive identity information; verify the request independently.": "Le message demande des données d'identité sensibles ; vérifiez la demande par un autre moyen.",
        "The message contains a web link; check its destination independently before opening it.": "Le message contient un lien ; vérifiez sa destination séparément avant de l'ouvrir.",
        "The link uses a numeric IP address instead of a familiar domain name.": "Le lien utilise une adresse IP numérique au lieu d'un nom de domaine connu.",
        "The domain uses encoded characters that can be used to imitate another name.": "Le domaine utilise des caractères encodés pouvant imiter un autre nom.",
        "The address has several nested subdomains; check the actual registered domain carefully.": "L'adresse comporte plusieurs sous-domaines ; vérifiez attentivement le domaine principal.",
        "A URL-shortening service hides the final destination.": "Un raccourcisseur d'URL masque la destination finale.",
        "The domain uses a suffix that is also seen in some deceptive links; this alone does not prove a scam.": "Le domaine utilise une extension également présente sur certains liens trompeurs ; cela ne prouve pas une fraude.",
        "The link does not use HTTPS, so its connection is not encrypted.": "Le lien n'utilise pas HTTPS ; la connexion n'est donc pas chiffrée.",
        "The link uses a non-standard web port.": "Le lien utilise un port web inhabituel.",
        "No strong signal was found by the local rules.": "Les règles locales n'ont détecté aucun indice fort.",
        "High risk indicators": "Indices de risque élevé",
        "Pause and verify": "Faites une pause et vérifiez",
        "Unable to determine": "Impossible à déterminer",
        "Do not open the link or send money.": "N'ouvrez pas le lien et n'envoyez pas d'argent.",
        "Do not share passwords, PINs, or verification codes.": "Ne partagez pas vos mots de passe, codes PIN ou codes de vérification.",
        "Contact the organization using a number or website you already trust.": "Contactez l'organisme via un numéro ou un site de confiance que vous connaissez déjà.",
        "Do not use contact details or links in the message.": "N'utilisez pas les coordonnées ni les liens du message.",
        "Check the request through the organization's official app or website.": "Vérifiez la demande sur l'application ou le site officiel de l'organisme.",
        "Never share a PIN, password, or one-time code.": "Ne partagez jamais un code PIN, un mot de passe ou un code à usage unique.",
        "No strong local-rule signal was found, but no live threat-list check is configured.": "Les règles locales n'ont détecté aucun indice fort, mais aucune vérification active des menaces n'est configurée.",
        "No live threat-list check is configured.": "Aucune vérification active des listes de menaces n'est configurée.",
        "Verify the sender independently before sharing information or paying.": "Vérifiez l'expéditeur par un autre moyen avant de partager des informations ou de payer.",
        "This is decision-support guidance, not a guarantee. No live threat-intelligence provider is configured.": "Ces conseils aident à décider mais ne constituent pas une garantie. Aucun service actif de renseignement sur les menaces n'est configuré.",
        "Your message is analyzed in memory and is not saved or sent to an external service.": "Votre message est analysé en mémoire ; il n'est ni enregistré ni transmis à un service externe.",
        "Enter one complete URL without spaces.": "Saisissez une URL complète sans espaces.",
        "That does not look like a valid web address.": "Cette adresse web ne semble pas valide.",
        "Enter a web address using HTTP or HTTPS; links with embedded credentials are not accepted.": "Saisissez une adresse HTTP ou HTTPS ; les liens contenant des identifiants sont refusés.",
        "Local network addresses cannot be checked.": "Les adresses du réseau local ne peuvent pas être vérifiées.",
        "Private or reserved IP addresses cannot be checked.": "Les adresses IP privées ou réservées ne peuvent pas être vérifiées.",
        "The web address contains an invalid port.": "L'adresse web contient un port invalide.",
        "Paste a message with at least 3 characters.": "Collez un message d'au moins 3 caractères.",
        "The message is too long (maximum 6,000 characters).": "Le message est trop long (6 000 caractères maximum).",
    },
    "hi": {
        "The message asks for a password, PIN, OTP, or verification code.": "संदेश में पासवर्ड, पिन, ओटीपी या सत्यापन कोड मांगा गया है।",
        "The message uses urgency or a threat to push a quick response.": "संदेश तुरंत जवाब दिलाने के लिए जल्दबाज़ी या धमकी का दबाव डालता है।",
        "The message asks for an upfront or unexpected fee.": "संदेश पहले से या अप्रत्याशित शुल्क मांगता है।",
        "The message promises an unexpected prize or gift.": "संदेश अप्रत्याशित इनाम या उपहार का वादा करता है।",
        "The message pushes you to click a link or verify an account.": "संदेश लिंक खोलने या खाते का सत्यापन करने का दबाव डालता है।",
        "The message promises unusually certain or high returns.": "संदेश असामान्य रूप से अधिक या निश्चित मुनाफ़े का वादा करता है।",
        "The message promises a job or easy income without enough verifiable detail.": "संदेश पर्याप्त सत्यापन योग्य जानकारी के बिना नौकरी या आसान कमाई का वादा करता है।",
        "The message asks for sensitive identity information; verify the request independently.": "संदेश संवेदनशील पहचान जानकारी मांगता है; अनुरोध की स्वतंत्र रूप से पुष्टि करें।",
        "The message contains a web link; check its destination independently before opening it.": "संदेश में वेब लिंक है; खोलने से पहले उसका गंतव्य अलग से जांचें।",
        "The link uses a numeric IP address instead of a familiar domain name.": "लिंक परिचित डोमेन के बजाय संख्यात्मक IP पता इस्तेमाल करता है।",
        "The domain uses encoded characters that can be used to imitate another name.": "डोमेन में एन्कोड किए गए अक्षर हैं जिनसे किसी दूसरे नाम की नकल हो सकती है।",
        "The address has several nested subdomains; check the actual registered domain carefully.": "पते में कई सबडोमेन हैं; असली मुख्य डोमेन ध्यान से जांचें।",
        "A URL-shortening service hides the final destination.": "URL छोटा करने वाली सेवा अंतिम गंतव्य छिपाती है।",
        "The domain uses a suffix that is also seen in some deceptive links; this alone does not prove a scam.": "डोमेन का प्रत्यय कुछ भ्रामक लिंक में भी दिखता है; इससे अकेले धोखाधड़ी साबित नहीं होती।",
        "The link does not use HTTPS, so its connection is not encrypted.": "लिंक HTTPS इस्तेमाल नहीं करता, इसलिए कनेक्शन एन्क्रिप्टेड नहीं है।",
        "The link uses a non-standard web port.": "लिंक सामान्य वेब पोर्ट के बजाय दूसरा पोर्ट इस्तेमाल करता है।",
        "No strong signal was found by the local rules.": "स्थानीय नियमों में कोई मज़बूत संकेत नहीं मिला।",
        "High risk indicators": "ज़्यादा जोखिम के संकेत",
        "Pause and verify": "रुकें और जांचें",
        "Unable to determine": "निर्धारित नहीं किया जा सका",
        "Do not open the link or send money.": "लिंक न खोलें और पैसे न भेजें।",
        "Do not share passwords, PINs, or verification codes.": "पासवर्ड, पिन या सत्यापन कोड साझा न करें।",
        "Contact the organization using a number or website you already trust.": "संगठन से उस नंबर या वेबसाइट पर संपर्क करें जिस पर आप पहले से भरोसा करते हैं।",
        "Do not use contact details or links in the message.": "संदेश में दिए संपर्क विवरण या लिंक इस्तेमाल न करें।",
        "Check the request through the organization's official app or website.": "संगठन के आधिकारिक ऐप या वेबसाइट से अनुरोध की जांच करें।",
        "Never share a PIN, password, or one-time code.": "पिन, पासवर्ड या एक बार इस्तेमाल होने वाला कोड कभी साझा न करें।",
        "No strong local-rule signal was found, but no live threat-list check is configured.": "स्थानीय नियमों में मज़बूत संकेत नहीं मिला, लेकिन लाइव खतरा-सूची जांच उपलब्ध नहीं है।",
        "No live threat-list check is configured.": "लाइव खतरा-सूची जांच उपलब्ध नहीं है।",
        "Verify the sender independently before sharing information or paying.": "जानकारी साझा करने या भुगतान से पहले किसी अलग माध्यम से भेजने वाले की पुष्टि करें।",
        "This is decision-support guidance, not a guarantee. No live threat-intelligence provider is configured.": "यह निर्णय लेने में मदद है, गारंटी नहीं। लाइव खतरा-जानकारी सेवा जुड़ी नहीं है।",
        "Your message is analyzed in memory and is not saved or sent to an external service.": "आपके संदेश का विश्लेषण मेमोरी में होता है; इसे सहेजा या बाहरी सेवा को भेजा नहीं जाता।",
        "Enter one complete URL without spaces.": "बिना खाली जगह के पूरा URL दर्ज करें।",
        "That does not look like a valid web address.": "यह वेब पता सही नहीं लगता।",
        "Enter a web address using HTTP or HTTPS; links with embedded credentials are not accepted.": "HTTP या HTTPS वाला वेब पता दर्ज करें; लॉगिन जानकारी वाले लिंक स्वीकार नहीं हैं।",
        "Local network addresses cannot be checked.": "स्थानीय नेटवर्क के पतों की जांच नहीं की जा सकती।",
        "Private or reserved IP addresses cannot be checked.": "निजी या आरक्षित IP पतों की जांच नहीं की जा सकती।",
        "The web address contains an invalid port.": "वेब पते में अमान्य पोर्ट है।",
        "Paste a message with at least 3 characters.": "कम से कम 3 अक्षरों वाला संदेश पेस्ट करें।",
        "The message is too long (maximum 6,000 characters).": "संदेश बहुत लंबा है (अधिकतम 6,000 अक्षर)।",
    },
    "ar": {
        "The message asks for a password, PIN, OTP, or verification code.": "تطلب الرسالة كلمة مرور أو رقم PIN أو رمز OTP أو رمز تحقق.",
        "The message uses urgency or a threat to push a quick response.": "تستخدم الرسالة الاستعجال أو التهديد للضغط عليك للرد بسرعة.",
        "The message asks for an upfront or unexpected fee.": "تطلب الرسالة رسوماً مقدماً أو رسوماً غير متوقعة.",
        "The message promises an unexpected prize or gift.": "تعدك الرسالة بجائزة أو هدية غير متوقعة.",
        "The message pushes you to click a link or verify an account.": "تضغط عليك الرسالة لفتح رابط أو التحقق من حساب.",
        "The message promises unusually certain or high returns.": "تعدك الرسالة بأرباح مرتفعة أو مضمونة بشكل غير معتاد.",
        "The message promises a job or easy income without enough verifiable detail.": "تعدك الرسالة بوظيفة أو دخل سهل من دون تفاصيل كافية يمكن التحقق منها.",
        "The message asks for sensitive identity information; verify the request independently.": "تطلب الرسالة معلومات هوية حساسة؛ تحقق من الطلب عبر قناة مستقلة.",
        "The message contains a web link; check its destination independently before opening it.": "تحتوي الرسالة على رابط؛ تحقق من وجهته بشكل مستقل قبل فتحه.",
        "The link uses a numeric IP address instead of a familiar domain name.": "يستخدم الرابط عنوان IP رقمياً بدلاً من اسم نطاق مألوف.",
        "The domain uses encoded characters that can be used to imitate another name.": "يستخدم النطاق أحرفاً مشفّرة قد تُستعمل لتقليد اسم آخر.",
        "The address has several nested subdomains; check the actual registered domain carefully.": "يحتوي العنوان على نطاقات فرعية متعددة؛ تحقق بعناية من النطاق الأساسي.",
        "A URL-shortening service hides the final destination.": "تخفي خدمة اختصار الروابط الوجهة النهائية.",
        "The domain uses a suffix that is also seen in some deceptive links; this alone does not prove a scam.": "يستخدم النطاق لاحقة تظهر أيضاً في بعض الروابط الخادعة؛ وهذا وحده لا يثبت الاحتيال.",
        "The link does not use HTTPS, so its connection is not encrypted.": "لا يستخدم الرابط HTTPS، لذا فإن الاتصال غير مشفّر.",
        "The link uses a non-standard web port.": "يستخدم الرابط منفذاً غير معتاد للويب.",
        "No strong signal was found by the local rules.": "لم تعثر القواعد المحلية على مؤشرات قوية.",
        "High risk indicators": "مؤشرات خطورة مرتفعة",
        "Pause and verify": "توقف وتحقق",
        "Unable to determine": "تعذر التحديد",
        "Do not open the link or send money.": "لا تفتح الرابط ولا ترسل الأموال.",
        "Do not share passwords, PINs, or verification codes.": "لا تشارك كلمات المرور أو أرقام PIN أو رموز التحقق.",
        "Contact the organization using a number or website you already trust.": "تواصل مع المؤسسة عبر رقم أو موقع موثوق تعرفه مسبقاً.",
        "Do not use contact details or links in the message.": "لا تستخدم بيانات الاتصال أو الروابط الواردة في الرسالة.",
        "Check the request through the organization's official app or website.": "تحقق من الطلب عبر التطبيق أو الموقع الرسمي للمؤسسة.",
        "Never share a PIN, password, or one-time code.": "لا تشارك أبداً رقم PIN أو كلمة مرور أو رمزاً لمرة واحدة.",
        "No strong local-rule signal was found, but no live threat-list check is configured.": "لم تعثر القواعد المحلية على مؤشرات قوية، ولا يتوفر فحص مباشر لقوائم التهديدات.",
        "No live threat-list check is configured.": "لا يتوفر فحص مباشر لقوائم التهديدات.",
        "Verify the sender independently before sharing information or paying.": "تحقق من المرسل عبر قناة مستقلة قبل مشاركة المعلومات أو الدفع.",
        "This is decision-support guidance, not a guarantee. No live threat-intelligence provider is configured.": "هذه إرشادات للمساعدة على اتخاذ القرار وليست ضماناً. لم يتم إعداد خدمة مباشرة لمعلومات التهديدات.",
        "Your message is analyzed in memory and is not saved or sent to an external service.": "تُحلل رسالتك في الذاكرة ولا تُحفظ أو تُرسل إلى خدمة خارجية.",
        "Enter one complete URL without spaces.": "أدخل رابطاً كاملاً واحداً من دون مسافات.",
        "That does not look like a valid web address.": "يبدو أن عنوان الويب غير صالح.",
        "Enter a web address using HTTP or HTTPS; links with embedded credentials are not accepted.": "أدخل عنواناً يبدأ بـ HTTP أو HTTPS؛ لا تُقبل الروابط التي تتضمن بيانات اعتماد.",
        "Local network addresses cannot be checked.": "لا يمكن فحص عناوين الشبكة المحلية.",
        "Private or reserved IP addresses cannot be checked.": "لا يمكن فحص عناوين IP الخاصة أو المحجوزة.",
        "The web address contains an invalid port.": "يحتوي عنوان الويب على منفذ غير صالح.",
        "Paste a message with at least 3 characters.": "الصق رسالة لا تقل عن 3 أحرف.",
        "The message is too long (maximum 6,000 characters).": "الرسالة طويلة جداً (الحد الأقصى 6000 حرف).",
    },
}
RESULT_TRANSLATIONS["bn"] = BN
MESSAGE_RULES = (
    (("otp", "one time password", "verification code", "pin", "পিন", "ওটিপি", "পাসওয়ার্ড", "যাচাইকরণ কোড", "গোপন কোড", "গোপন নম্বর", "código otp", "código de verificación", "contraseña", "mot de passe", "code de vérification", "पासवर्ड", "ओटीपी", "सत्यापन कोड", "رمز التحقق", "كلمة المرور", "رمز otp"), "requests_secret", 24, "The message asks for a password, PIN, OTP, or verification code."),
    (("urgent", "immediately", "within 24 hours", "account will be blocked", "জরুরি", "এখনই", "অ্যাকাউন্ট বন্ধ", "অ্যাকাউন্ট ব্লক", "আজই শেষ", "তাৎক্ষণিকভাবে", "দ্রুত করুন", "urgente", "inmediatamente", "cuenta bloqueada", "de inmediato", "urgent", "immédiatement", "compte bloqué", "tout de suite", "तुरंत", "अभी करें", "खाता बंद", "तत्काल", "عاجل", "فوراً", "سيتم إيقاف الحساب", "حالاً"), "creates_urgency", 16, "The message uses urgency or a threat to push a quick response."),
    (("pay a fee", "registration fee", "processing fee", "upfront fee", "আগে টাকা", "রেজিস্ট্রেশন ফি", "আগাম ফি", "প্রসেসিং ফি", "জামানত দিন", "ফি জমা দিন", "টাকা পাঠান", "paga una tarifa", "tarifa de registro", "pago por adelantado", "frais d'inscription", "frais à payer", "payer des frais", "पंजीकरण शुल्क", "पहले पैसे भेजें", "अग्रिम शुल्क", "رسوم التسجيل", "ادفع الرسوم", "رسوم مقدماً"), "requests_upfront_payment", 24, "The message asks for an upfront or unexpected fee."),
    (("claim your prize", "you have won", "free gift", "পুরস্কার জিতেছেন", "বিনামূল্যে উপহার", "লটারি জিতেছেন", "পুরস্কার পেয়েছেন", "has ganado", "reclama tu premio", "regalo gratis", "vous avez gagné", "réclamez votre prix", "cadeau gratuit", "इनाम जीता", "आप जीत गए", "मुफ़्त उपहार", "لقد فزت", "استلم جائزتك", "هدية مجانية"), "unexpected_prize", 12, "The message promises an unexpected prize or gift."),
    (("click here", "verify your account", "login to confirm", "এখানে ক্লিক", "অ্যাকাউন্ট যাচাই", "লিংকে ক্লিক", "লগইন করে নিশ্চিত", "haz clic aquí", "verifica tu cuenta", "cliquez ici", "vérifiez votre compte", "यहाँ क्लिक करें", "खाते की पुष्टि करें", "اضغط هنا", "تحقق من حسابك"), "pushes_link_action", 10, "The message pushes you to click a link or verify an account."),
    (("guaranteed profit", "double your money", "risk-free investment", "নিশ্চিত লাভ", "টাকা দ্বিগুণ", "নিশ্চিত মুনাফা", "ঝুঁকি ছাড়া লাভ", "ganancias garantizadas", "duplica tu dinero", "sans risque", "profits garantis", "गारंटीशुदा मुनाफ़ा", "पैसे दोगुने", "ربح مضمون", "ضاعف أموالك"), "unrealistic_return", 18, "The message promises unusually certain or high returns."),
    (("you have been selected", "congratulations you got the job", "নিয়োগ নিশ্চিত", "চাকরি পেয়েছেন", "চাকরিতে নির্বাচিত", "বাড়িতে বসে আয়", "has sido seleccionado", "oferta de empleo", "vous avez été sélectionné", "offre d'emploi", "नौकरी मिल गई", "नौकरी के लिए चुने गए", "تم اختيارك للوظيفة", "وظيفة مضمونة"), "job_offer", 12, "The message promises a job or easy income without enough verifiable detail."),
    (("send your national id", "send your nid", "জাতীয় পরিচয়পত্র", "এনআইডি পাঠান", "জন্ম নিবন্ধন পাঠান", "envía tu documento de identidad", "envoyez votre pièce d'identité", "पहचान पत्र भेजें", "आधार कार्ड भेजें", "أرسل بطاقة هويتك", "رقم الهوية"), "requests_identity_data", 12, "The message asks for sensitive identity information; verify the request independently."),
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _evidence(code: str, explanation: str, strength: str) -> dict[str, str]:
    return {"type": code, "text": explanation, "strength": strength, "source": "ClearBeacon local rules"}


def _translate(text: str, locale: str) -> str:
    return RESULT_TRANSLATIONS.get(locale, {}).get(text, text)


def _result(signals: list[dict[str, str]], score: int, checked: list[str], locale: str = "en") -> dict[str, object]:
    score = min(score, 100)
    if score >= 65:
        label = "high_risk"
        title = "High risk indicators"
        advice = ["Do not open the link or send money.", "Do not share passwords, PINs, or verification codes.", "Contact the organization using a number or website you already trust."]
    elif score >= 30:
        label = "caution"
        title = "Pause and verify"
        advice = ["Do not use contact details or links in the message.", "Check the request through the organization's official app or website.", "Never share a PIN, password, or one-time code."]
    elif checked:
        label = "unknown"
        title = "Unable to determine"
        advice = ["No strong local-rule signal was found, but no live threat-list check is configured.", "Verify the sender independently before sharing information or paying."]
    else:
        label = "unknown"
        title = "Unable to determine"
        advice = ["No live threat-list check is configured.", "Verify the sender independently before sharing information or paying."]
    return {
        "risk_label": label,
        "title": _translate(title, locale),
        "score": score,
        "decision_reason": [_translate(item["text"], locale) for item in signals] or [_translate("No strong signal was found by the local rules.", locale)],
        "evidence": [{**item, "text": _translate(item["text"], locale)} for item in signals],
        "coverage": [
            {"check": "local_rules", "status": "completed", "provider": "ClearBeacon"},
            {"check": "threat_intelligence", "status": "not_configured", "provider": None},
        ],
        "recommended_actions": [_translate(item, locale) for item in advice],
        "generated_at": _now(),
        "ruleset_version": RULESET_VERSION,
        "disclaimer": _translate("This is decision-support guidance, not a guarantee. No live threat-intelligence provider is configured.", locale),
        "locale": locale,
    }


def _validate_url(value: str, locale: str = "en") -> tuple[str, str]:
    locale = locale if locale in SUPPORTED_LOCALES else "en"
    candidate = value.strip()
    if not candidate or len(candidate) > 2048 or any(character.isspace() for character in candidate):
        raise ValueError(_translate("Enter one complete URL without spaces.", locale))
    if "://" not in candidate:
        candidate = "https://" + candidate
    try:
        parsed = urlsplit(candidate)
        hostname = parsed.hostname
        scheme = parsed.scheme.lower()
        port = parsed.port
    except ValueError as error:
        raise ValueError(_translate("That does not look like a valid web address.", locale)) from error
    if scheme not in {"http", "https"} or not hostname or parsed.username is not None or parsed.password is not None:
        raise ValueError(_translate("Enter a web address using HTTP or HTTPS; links with embedded credentials are not accepted.", locale))
    host = hostname.rstrip(".").lower()
    if host in {"localhost", "localhost.localdomain"} or host.endswith(".localhost") or host.endswith(".local"):
        raise ValueError(_translate("Local network addresses cannot be checked.", locale))
    try:
        address = ip_address(host)
    except ValueError:
        address = None
    if address is not None and (not address.is_global):
        raise ValueError(_translate("Private or reserved IP addresses cannot be checked.", locale))
    if port is not None and not (1 <= port <= 65535):
        raise ValueError(_translate("The web address contains an invalid port.", locale))
    return candidate, host


def _url_signals(host: str, scheme: str, port: int | None, path: str = "") -> tuple[list[dict[str, str]], int]:
    signals: list[dict[str, str]] = []
    score = 0
    try:
        address = ip_address(host)
    except ValueError:
        address = None
    if address is not None:
        signals.append(_evidence("ip_address_host", "The link uses a numeric IP address instead of a familiar domain name.", "medium"))
        score += 18
    if host.startswith("xn--") or ".xn--" in host:
        signals.append(_evidence("punycode_hostname", "The domain uses encoded characters that can be used to imitate another name.", "medium"))
        score += 18
    if any(ord(character) > 127 for character in host):
        signals.append(_evidence("unicode_hostname", "The domain contains non-ASCII characters; check carefully for lookalike letters.", "weak"))
        score += 10
    labels = host.split(".")
    if any(len(label) >= 12 and sum(character.isdigit() for character in label) >= 6 for label in labels):
        signals.append(_evidence("digit_heavy_hostname", "A hostname label contains an unusually dense sequence of digits.", "weak"))
        score += 8
    if re.search(r"%(?:2f|5c|40|2e)", path, re.IGNORECASE):
        signals.append(_evidence("encoded_url_path", "The address contains encoded separators or punctuation that can obscure its path.", "weak"))
        score += 8
    if host.count(".") >= 4:
        signals.append(_evidence("many_subdomains", "The address has several nested subdomains; check the actual registered domain carefully.", "weak"))
        score += 10
    if host in SHORTENERS:
        signals.append(_evidence("shortened_url", "A URL-shortening service hides the final destination.", "weak"))
        score += 12
    if any(host.endswith(tld) for tld in RISKY_TLDS):
        signals.append(_evidence("uncommon_domain_suffix", "The domain uses a suffix that is also seen in some deceptive links; this alone does not prove a scam.", "weak"))
        score += 8
    if scheme == "http":
        signals.append(_evidence("unencrypted_http", "The link does not use HTTPS, so its connection is not encrypted.", "weak"))
        score += 8
    if port not in (None, 80, 443):
        signals.append(_evidence("unusual_port", "The link uses a non-standard web port.", "weak"))
        score += 8
    return signals, score


def analyze_url(value: str, locale: str = "en") -> dict[str, object]:
    locale = locale if locale in SUPPORTED_LOCALES else "en"
    candidate, host = _validate_url(value, locale)
    parsed = urlsplit(candidate)
    signals, score = _url_signals(host, parsed.scheme.lower(), parsed.port, parsed.path)
    result = _result(signals, score, ["local_rules"], locale)
    result["input_type"] = "url"
    result["normalized_host"] = host
    return result


def analyze_message(value: str, locale: str = "en") -> dict[str, object]:
    locale = locale if locale in SUPPORTED_LOCALES else "en"
    message = value.strip()
    if len(message) < 3:
        raise ValueError(_translate("Paste a message with at least 3 characters.", locale))
    if len(message) > 6000:
        raise ValueError(_translate("The message is too long (maximum 6,000 characters).", locale))
    lowered = message.casefold()
    signals: list[dict[str, str]] = []
    score = 0
    for phrases, code, weight, explanation in MESSAGE_RULES:
        if any(phrase.casefold() in lowered for phrase in phrases):
            signals.append(_evidence(code, explanation, "medium" if weight >= 18 else "weak"))
            score += weight
    links = []
    seen_hosts: set[str] = set()
    for match in URL_PATTERN.findall(message):
        candidate = match.rstrip(".,!?;:)")
        try:
            _, host = _validate_url(candidate, locale)
        except ValueError:
            continue
        if host not in seen_hosts:
            links.append(host)
            seen_hosts.add(host)
            parsed = urlsplit(candidate if "://" in candidate else "https://" + candidate)
            url_evidence, url_score = _url_signals(host, parsed.scheme.lower(), parsed.port, parsed.path)
            if url_evidence:
                signals.extend(url_evidence)
                score += url_score
    if links:
        signals.append(_evidence("contains_link", "The message contains a web link; check its destination independently before opening it.", "weak"))
    result = _result(signals, score, ["local_rules"], locale)
    result["input_type"] = "message"
    result["detected_links"] = links
    result["privacy_note"] = _translate("Your message is analyzed in memory and is not saved or sent to an external service.", locale)
    return result
