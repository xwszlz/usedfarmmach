/**
 * fix-translations.js  (v2 — comprehensive)
 *
 * Fixes 3 issues across 8 language files:
 * 1. Encoding fix: es.json & pt.json — stripped accent characters restored
 * 2. Missing keys: 29 keys added to es/pt/ar/fr/hi; 1 key added to ru
 * 3. Footer update: old 4 keys removed, new 4 keys + updated quickLinks in es/pt/ar/fr/hi
 *
 * Usage: node fix-translations.js
 */

const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, 'messages');

// ─── Helper: apply string replacements ───────────────────────────
function applyReplacements(content, replacements) {
  let result = content;
  for (const [from, to] of replacements) {
    result = result.split(from).join(to);
  }
  return result;
}

// ─── Spanish encoding replacements ───────────────────────────────
// CRITICAL: "a o" is NOT safe as a broad replacement (matches "Alta oportunidad").
// Use context-specific patterns instead.
const esReplacements = [
  // ── Fix false positives from any prior run ──
  ['Altañoportunidad', 'Alta oportunidad'],
  ['Úúltima', 'Última'],

  // ── Specific multi-word / context patterns ──
  ['"Algo sali  mal"', '"Algo salió mal"'],
  ['" 2024 Shijiazhuang', '"© 2024 Shijiazhuang'],
  ['" {price}"', '"¥{price}"'],
  ['" No tiene cuenta?"', '"¿No tiene cuenta?"'],
  ['" Ya tiene cuenta?"', '"¿Ya tiene cuenta?"'],
  ['"Qu informaci n necesita?"', '"¿Qué información necesita?"'],
  ['contactar  pronto', 'contactará pronto'],  // á→space + existing space = double space

  // ── "a o" → "año" (SAFE patterns only) ──
  ['"A o"', '"Año"'],       // standalone JSON value
  ['"Año m s', '"Año más'],  // sortYearNew (after m s fix)
  ['"A o m', '"Año m'],     // sortYearNew (before m s fix)
  [' a os', ' años'],        // plural in middle of string (space prevents false match)

  // ── Capital-letter variants ──
  ['Agr cola', 'Agrícola'],      // capital A (appSlogan)
  ['Categor a ', 'Categoría '],  // singular capital (categoryPage.notFound)
  ['M ltiples', 'Múltiples'],    // capital M (logistics.subtitle)
  ['Mar timo', 'Marítimo'],      // capital M (logistics.step4Desc)
  ['M nimo', 'Mínimo'],          // capital M (register)
  ['M n.', 'Mín.'],              // capital M abbreviated (register)

  // ── Lowercase word-level patterns (longer first) ──
  ['automáticamente', 'automáticamente'],  // no-op safety (already correct in some)
  ['caracter sticas', 'características'],
  ['actualizaci n', 'actualización'],
  ['configuraci n', 'configuración'],
  ['Recomendaci n', 'Recomendación'],
  ['informaci n', 'información'],
  ['Ubicaci n', 'Ubicación'],
  ['Descripci n', 'Descripción'],
  ['Inspecci n', 'Inspección'],
  ['Explicaci n', 'Explicación'],
  ['Valoraci n', 'Valoración'],
  ['Tasaci n', 'Tasación'],
  ['selecci n', 'selección'],
  ['evaluaci n', 'evaluación'],
  ['cotizaci n', 'cotización'],
  ['puntuaci n', 'puntuación'],
  ['protecci n', 'protección'],
  ['Informaci n', 'Información'],
  ['Direcci n', 'Dirección'],
  ['exportaci n', 'exportación'],
  ['importaci n', 'importación'],
  ['Gesti n', 'Gestión'],
  ['Puntuaci n', 'Puntuación'],
  ['Evaluaci n', 'Evaluación'],
  ['Acci n', 'Acción'],
  ['garant a', 'garantía'],
  ['contrase a', 'contraseña'],
  ['Contrase a', 'Contraseña'],
  ['Categor as', 'Categorías'],
  ['categor a', 'categoría'],
  ['subcategor as', 'subcategorías'],
  ['vol menes', 'volúmenes'],
  ['econ mico', 'económico'],
  ['mayúsculas', 'mayúsculas'],  // no-op safety
  ['may sculas', 'mayúsculas'],
  ['min sculas', 'minúsculas'],
  ['electr nico', 'electrónico'],
  ['Pol tica', 'Política'],
  ['pol ticas', 'políticas'],
  ['T rminos', 'Términos'],
  ['t rmino', 'término'],
  ['r pidos', 'rápidos'],
  ['r pida', 'rápida'],
  ['m xima', 'máxima'],
  ['asimetr a', 'asimetría'],
  ['Din mica', 'Dinámica'],
  ['Evoluci n', 'Evolución'],
  ['rese as', 'reseñas'],
  ['Art culos', 'Artículos'],
  ['art culos', 'artículos'],
  ['gu as', 'guías'],
  ['Dep sito', 'Depósito'],
  ['compa a', 'compañía'],
  ['b squeda', 'búsqueda'],
  ['p gina', 'página'],
  ['n meros', 'números'],
  ['n mero', 'número'],
  ['fam lia', 'familia'],
  ['categora', 'categoría'],
  ['agr cola', 'agrícola'],
  ['Log stica', 'Logística'],
  ['log stica', 'logística'],
  ['sesi n', 'sesión'],
  ['Tel fono', 'Teléfono'],
  ['tel fono', 'teléfono'],
  ['Pa s', 'País'],
  ['pa s', 'país'],
  ['Jap n', 'Japón'],
  ['l der', 'líder'],
  ['C mo', 'Cómo'],
  ['seg n', 'según'],
  ['d as', 'días'],
  ['da os', 'daños'],
  ['tr mites', 'trámites'],
  ['mar timo', 'marítimo'],
  ['a reo', 'aéreo'],
  ['misi n', 'misión'],
  ['an lisis', 'análisis'],
  ['D lar', 'Dólar'],
  ['t cnico', 'técnico'],
  ['gui n', 'guion'],       // Spanish: "guion" has no accent (RAE)
  ['m s ', 'más '],         // lowercase "más" with trailing space
  ['"M s"', '"Más"'],       // standalone "Más"
  [' ltima', 'Última'],     // leading space = stripped Ú
  // NOTE: do NOT add ['ltima', 'última'] — causes double-replacement with [' ltima', 'Última']
];

// ─── Portuguese encoding replacements ────────────────────────────
const ptReplacements = [
  // ── Fix false positives from any prior run ──
  ['Úúltima', 'Última'],

  // ── Specific multi-word / context patterns ──
  ['" 2024 Shijiazhuang', '"© 2024 Shijiazhuang'],
  ['" {price}"', '"¥{price}"'],
  ['"J  tem conta?"', '"Já tem conta?"'],
  ['"N o tem conta?"', '"Não tem conta?"'],
  ['de at  40%', 'de até 40%'],
  ['entrar  em contato', 'entrará em contato'],
  ['Marca n o encontrada', 'Marca não encontrada'],
  ['Categoria n o encontrada', 'Categoria não encontrada'],
  ['n o coincidem', 'não coincidem'],
  ['Voltar  lista', 'Voltar à lista'],  // à → double space
  ['Sobre n s', 'Sobre nós'],
  ['um s lugar', 'um só lugar'],

  // ── Word-level patterns (longer / more specific first) ──
  ['Precifica o', 'Precificação'],
  ['Especifica es', 'Especificações'],
  ['Transa es', 'Transações'],         // capital T
  ['transa es', 'transações'],         // lowercase
  ['autom tica', 'automática'],
  ['Transpar ncia', 'Transparência'],
  ['experi ncia', 'experiência'],
  ['Recomenda o', 'Recomendação'],
  ['dispon veis', 'disponíveis'],
  ['localiza es', 'localizações'],
  ['Localiza o', 'Localização'],
  ['localiza o', 'localização'],
  ['atualiza o', 'atualização'],
  ['Avalia o', 'Avaliação'],
  ['avalia o', 'avaliação'],
  ['Pontua o', 'Pontuação'],
  ['Explica o', 'Explicação'],
  ['Compara o', 'Comparação'],
  ['Descri o', 'Descrição'],
  ['Diferen a', 'Diferença'],
  ['Cobran a', 'Cobrança'],
  ['Seguran a', 'Segurança'],
  ['seguran a', 'segurança'],
  ['Efici ncia', 'Eficiência'],
  ['Urg ncias', 'Urgências'],
  ['inclu do', 'incluído'],
  ['benef cio', 'benefício'],
  ['Intelig ncia', 'Inteligência'],
  ['Not cias', 'Notícias'],
  ['not cias', 'notícias'],
  ['Cont iner', 'Contêiner'],
  ['cont iner', 'contêiner'],
  ['Munic pio', 'Município'],
  ['Tend ncia', 'Tendência'],
  ['tend ncias', 'tendências'],
  ['Evolu o', 'Evolução'],
  ['Din mica', 'Dinâmica'],
  ['Endere o', 'Endereço'],
  ['Pol tica', 'Política'],
  ['pol ticas', 'políticas'],
  ['Obrigat rio', 'Obrigatório'],
  ['Flex vel', 'Flexível'],
  ['flex vel', 'flexível'],
  ['servi o', 'serviço'],
  ['Servi o', 'Serviço'],
  ['Inspe o', 'Inspeção'],
  ['Usu rio', 'Usuário'],
  ['usu rio', 'usuário'],
  ['M quinas', 'Máquinas'],
  ['m quinas', 'máquinas'],
  ['agr colas', 'agrícolas'],
  ['agr cola', 'agrícola'],
  ['Log stica', 'Logística'],
  ['log stica', 'logística'],
  ['pre os', 'preços'],
  ['Pre o', 'Preço'],
  ['pre o', 'preço'],
  ['r pidos', 'rápidos'],
  ['r pida', 'rápida'],
  ['Mar timo', 'Marítimo'],
  ['mar timo', 'marítimo'],
  ['a reo', 'aéreo'],
  ['In cio', 'Início'],
  ['in cio', 'início'],
  ['Pr ximo', 'Próximo'],
  ['D lar', 'Dólar'],
  ['an lise', 'análise'],
  ['An lise', 'Análise'],
  ['m dia', 'média'],
  ['M dia', 'Média'],
  ['m dios', 'médios'],
  ['A o', 'Ação'],
  ['Posi o', 'Posição'],
  ['p gina', 'página'],
  ['c mbio', 'câmbio'],
  ['refer ncia', 'referência'],
  ['ltima', 'última'],
  [' ltima', 'Última'],       // leading space = stripped Ú
  ['M nimo', 'Mínimo'],
  ['M n.', 'Mín.'],
  ['n meros', 'números'],
  ['mai sculas', 'maiúsculas'],
  ['min sculas', 'minúsculas'],
  ['Pa s', 'País'],
  ['pa s', 'país'],
  ['Jap o', 'Japão'],
  ['l der', 'líder'],
  ['econ mico', 'econômico'],
  ['Dep sito', 'Depósito'],
  ['prote o', 'proteção'],
  ['exporta o', 'exportação'],
  ['importa o', 'importação'],
  ['Gest o', 'Gestão'],
  ['tr mites', 'trâmites'],
  ['t cnica', 'técnica'],
  ['miss o', 'missão'],
  ['com rcio', 'comércio'],
  ['Atrav s', 'Através'],
  ['m tuo', 'mútuo'],
  ['obt m', 'obtém'],
  ['M ltiplas', 'Múltiplas'],
  ['m xima', 'máxima'],
  ['v deo', 'vídeo'],
  ['chin s', 'chinês'],
  ['n o ', 'não '],
  ['N o ', 'Não '],
];

// ─── New translation data ────────────────────────────────────────

const navInquiryManagement = {
  es: 'Consultas',
  pt: 'Consultas',
  ar: 'الاستفسارات',
  fr: 'Demandes',
  hi: 'पूछताछ',
  ru: 'Запросы',
};

const loginForgotPassword = {
  es: '¿Olvidó su contraseña?',
  pt: 'Esqueceu a senha?',
  ar: 'نسيت كلمة المرور؟',
  fr: 'Mot de passe oublié ?',
  hi: 'पासवर्ड भूल गए?',
};

const forgotPasswordData = {
  es: {
    title: 'Recuperar contraseña',
    subtitle: 'Ingrese su usuario o correo para recibir un enlace de restablecimiento',
    identifier: 'Usuario o correo',
    identifierPlaceholder: 'Ingrese su usuario o correo registrado',
    hint: 'Enviaremos un enlace de restablecimiento a su correo registrado',
    submit: 'Enviar enlace',
    errorEmpty: 'Por favor ingrese usuario o correo',
    sentMessage: 'Si la cuenta existe con un correo, se ha enviado un enlace de restablecimiento. Revise su bandeja de entrada (y carpeta de spam).',
    backToLogin: 'Volver al inicio de sesión',
    error: 'Operación fallida, intente más tarde',
  },
  pt: {
    title: 'Recuperar senha',
    subtitle: 'Digite seu usuário ou e-mail para receber um link de redefinição',
    identifier: 'Usuário ou e-mail',
    identifierPlaceholder: 'Digite seu usuário ou e-mail registrado',
    hint: 'Enviaremos um link de redefinição para seu e-mail registrado',
    submit: 'Enviar link',
    errorEmpty: 'Por favor digite usuário ou e-mail',
    sentMessage: 'Se a conta existir com um e-mail, um link de redefinição foi enviado. Verifique sua caixa de entrada (e pasta de spam).',
    backToLogin: 'Voltar ao login',
    error: 'Operação falhou, tente novamente mais tarde',
  },
  ar: {
    title: 'استعادة كلمة المرور',
    subtitle: 'أدخل اسم المستخدم أو البريد الإلكتروني لتلقي رابط إعادة التعيين',
    identifier: 'اسم المستخدم أو البريد الإلكتروني',
    identifierPlaceholder: 'أدخل اسم المستخدم أو البريد الإلكتروني المسجل',
    hint: 'سنرسل رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني المسجل',
    submit: 'إرسال الرابط',
    errorEmpty: 'الرجاء إدخال اسم المستخدم أو البريد الإلكتروني',
    sentMessage: 'إذا كان الحساب موجوداً مع بريد إلكتروني، فقد تم إرسال رابط إعادة التعيين. يرجى التحقق من صندوق الوارد (ومجلد الرسائل غير المرغوب فيها).',
    backToLogin: 'العودة إلى تسجيل الدخول',
    error: 'فشلت العملية، يرجى المحاولة لاحقاً',
  },
  fr: {
    title: 'Mot de passe oublié',
    subtitle: 'Entrez votre nom d\'utilisateur ou e-mail pour recevoir un lien de réinitialisation',
    identifier: 'Nom d\'utilisateur ou e-mail',
    identifierPlaceholder: 'Entrez votre nom d\'utilisateur ou e-mail enregistré',
    hint: 'Nous enverrons un lien de réinitialisation à votre e-mail enregistré',
    submit: 'Envoyer le lien',
    errorEmpty: 'Veuillez entrer votre nom d\'utilisateur ou e-mail',
    sentMessage: 'Si le compte existe avec un e-mail, un lien de réinitialisation a été envoyé. Vérifiez votre boîte de réception (et dossier spam).',
    backToLogin: 'Retour à la connexion',
    error: 'Échec de l\'opération, veuillez réessayer plus tard',
  },
  hi: {
    title: 'पासवर्ड भूल गए',
    subtitle: 'रीसेट लिंक प्राप्त करने के लिए अपना यूज़रनेम या ईमेल दर्ज करें',
    identifier: 'यूज़रनेम या ईमेल',
    identifierPlaceholder: 'अपना पंजीकृत यूज़रनेम या ईमेल दर्ज करें',
    hint: 'हम आपके पंजीकृत ईमेल पर पासवर्ड रीसेट लिंक भेजेंगे',
    submit: 'रीसेट लिंक भेजें',
    errorEmpty: 'कृपया यूज़रनेम या ईमेल दर्ज करें',
    sentMessage: 'यदि खाता ईमेल के साथ मौजूद है, तो रीसेट लिंक भेज दिया गया है। कृपया अपना इनबॉक्स (और स्पैम फोल्डर) जांचें।',
    backToLogin: 'लॉगिन पर वापस',
    error: 'ऑपरेशन विफल, कृपया बाद में पुनः प्रयास करें',
  },
};

const resetPasswordData = {
  es: {
    title: 'Restablecer contraseña',
    subtitle: 'Ingrese su nueva contraseña',
    newPassword: 'Nueva contraseña',
    passwordPlaceholder: 'Mínimo 6 caracteres',
    confirmPassword: 'Confirmar nueva contraseña',
    confirmPlaceholder: 'Ingrese la nueva contraseña nuevamente',
    submit: 'Restablecer contraseña',
    tooShort: 'La contraseña debe tener al menos 6 caracteres',
    mismatch: 'Las contraseñas no coinciden',
    successMessage: '¡Contraseña restablecida! Redirigiendo al inicio de sesión...',
    noToken: 'Falta el token de restablecimiento. Acceda a esta página mediante el enlace de su correo.',
    requestNew: 'Solicitar nuevo enlace',
    error: 'Error al restablecer, intente más tarde',
  },
  pt: {
    title: 'Redefinir senha',
    subtitle: 'Digite sua nova senha',
    newPassword: 'Nova senha',
    passwordPlaceholder: 'Mínimo 6 caracteres',
    confirmPassword: 'Confirmar nova senha',
    confirmPlaceholder: 'Digite a nova senha novamente',
    submit: 'Redefinir senha',
    tooShort: 'A senha deve ter pelo menos 6 caracteres',
    mismatch: 'As senhas não coincidem',
    successMessage: 'Senha redefinida! Redirecionando para o login...',
    noToken: 'Token de redefinição ausente. Acesse esta página através do link em seu e-mail.',
    requestNew: 'Solicitar novo link',
    error: 'Falha na redefinição, tente mais tarde',
  },
  ar: {
    title: 'إعادة تعيين كلمة المرور',
    subtitle: 'أدخل كلمة المرور الجديدة',
    newPassword: 'كلمة المرور الجديدة',
    passwordPlaceholder: '6 أحرف على الأقل',
    confirmPassword: 'تأكيد كلمة المرور الجديدة',
    confirmPlaceholder: 'أدخل كلمة المرور الجديدة مرة أخرى',
    submit: 'إعادة تعيين كلمة المرور',
    tooShort: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل',
    mismatch: 'كلمتا المرور غير متطابقتين',
    successMessage: 'تم إعادة تعيين كلمة المرور بنجاح! جاري إعادة التوجيه إلى تسجيل الدخول...',
    noToken: 'رمز إعادة التعيين مفقود. يرجى الوصول إلى هذه الصفحة عبر الرابط في بريدك الإلكتروني.',
    requestNew: 'طلب رابط جديد',
    error: 'فشل إعادة التعيين، حاول لاحقاً',
  },
  fr: {
    title: 'Réinitialiser le mot de passe',
    subtitle: 'Entrez votre nouveau mot de passe',
    newPassword: 'Nouveau mot de passe',
    passwordPlaceholder: 'Au moins 6 caractères',
    confirmPassword: 'Confirmer le nouveau mot de passe',
    confirmPlaceholder: 'Entrez à nouveau le mot de passe',
    submit: 'Réinitialiser',
    tooShort: 'Le mot de passe doit comporter au moins 6 caractères',
    mismatch: 'Les mots de passe ne correspondent pas',
    successMessage: 'Mot de passe réinitialisé ! Redirection vers la connexion...',
    noToken: 'Jeton de réinitialisation manquant. Accédez à cette page via le lien dans votre e-mail.',
    requestNew: 'Demander un nouveau lien',
    error: 'Échec de la réinitialisation, réessayez plus tard',
  },
  hi: {
    title: 'पासवर्ड रीसेट करें',
    subtitle: 'अपना नया पासवर्ड दर्ज करें',
    newPassword: 'नया पासवर्ड',
    passwordPlaceholder: 'कम से कम 6 अक्षर',
    confirmPassword: 'नए पासवर्ड की पुष्टि करें',
    confirmPlaceholder: 'नया पासवर्ड फिर से दर्ज करें',
    submit: 'पासवर्ड रीसेट करें',
    tooShort: 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए',
    mismatch: 'पासवर्ड मेल नहीं खाते',
    successMessage: 'पासवर्ड रीसेट सफल! लॉगिन पेज पर रीडायरेक्ट हो रहा है...',
    noToken: 'रीसेट टोकन गायब है। कृपया अपने ईमेल में लिंक के माध्यम से इस पेज तक पहुंचें।',
    requestNew: 'नया रीसेट लिंक अनुरोध करें',
    error: 'रीसेट विफल, कृपया बाद में पुनः प्रयास करें',
  },
};

const footerData = {
  es: {
    quickLinks: 'Plataformas destacadas',
    quickLinkRb: 'Ritchie Bros Auctioneers',
    quickLinkCamda: 'Asociación China de Distribución de Maquinaria Agrícola',
    quickLinkTractorHouse: 'TractorHouse',
    quickLinkAgriaffaires: 'Agriaffaires',
  },
  pt: {
    quickLinks: 'Plataformas parceiras',
    quickLinkRb: 'Ritchie Bros Auctioneers',
    quickLinkCamda: 'Associação Chinesa de Distribuição de Máquinas Agrícolas',
    quickLinkTractorHouse: 'TractorHouse',
    quickLinkAgriaffaires: 'Agriaffaires',
  },
  ar: {
    quickLinks: 'شركاء الصناعة',
    quickLinkRb: 'Ritchie Bros Auctioneers',
    quickLinkCamda: 'الجمعية الصينية لتوزيع الآلات الزراعية',
    quickLinkTractorHouse: 'TractorHouse',
    quickLinkAgriaffaires: 'Agriaffaires',
  },
  fr: {
    quickLinks: 'Partenaires de l\'industrie',
    quickLinkRb: 'Ritchie Bros Auctioneers',
    quickLinkCamda: 'Association chinoise de distribution de machines agricoles',
    quickLinkTractorHouse: 'TractorHouse',
    quickLinkAgriaffaires: 'Agriaffaires',
  },
  hi: {
    quickLinks: 'उद्योग भागीदार',
    quickLinkRb: 'Ritchie Bros Auctioneers',
    quickLinkCamda: 'चीन कृषि मशीनरी वितरण संघ',
    quickLinkTractorHouse: 'TractorHouse',
    quickLinkAgriaffaires: 'Agriaffaires',
  },
};

const oldFooterKeys = ['quickLinkForage', 'quickLinkClaas', 'quickLinkValuation', 'quickLinkArbitrage'];

// ─── Processing functions ────────────────────────────────────────

function collectKeyPaths(obj, prefix = '') {
  const paths = new Set();
  for (const key of Object.keys(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      const subPaths = collectKeyPaths(obj[key], fullPath);
      subPaths.forEach(p => paths.add(p));
    } else {
      paths.add(fullPath);
    }
  }
  return paths;
}

function addMissingKeys(data, lang) {
  let changes = [];

  if (!data.nav.inquiryManagement) {
    data.nav.inquiryManagement = navInquiryManagement[lang];
    changes.push('nav.inquiryManagement');
  }

  if (data.auth && data.auth.login && !data.auth.login.forgotPassword) {
    data.auth.login.forgotPassword = loginForgotPassword[lang];
    changes.push('auth.login.forgotPassword');
  }

  if (data.auth && !data.auth.forgotPassword) {
    data.auth.forgotPassword = { ...forgotPasswordData[lang] };
    changes.push('auth.forgotPassword (10 keys)');
  }

  if (data.auth && !data.auth.resetPassword) {
    data.auth.resetPassword = { ...resetPasswordData[lang] };
    changes.push('auth.resetPassword (13 keys)');
  }

  return changes;
}

function updateFooter(data, lang) {
  let changes = [];

  if (!data.footer) return changes;

  for (const oldKey of oldFooterKeys) {
    if (data.footer[oldKey] !== undefined) {
      delete data.footer[oldKey];
      changes.push(`footer.${oldKey} (removed)`);
    }
  }

  const footer = footerData[lang];
  for (const [key, value] of Object.entries(footer)) {
    if (data.footer[key] !== value) {
      data.footer[key] = value;
      changes.push(`footer.${key}`);
    }
  }

  return changes;
}

function processLanguage(lang) {
  const filePath = path.join(MESSAGES_DIR, `${lang}.json`);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Processing: ${lang}.json`);
  console.log(`${'═'.repeat(60)}`);

  let content = fs.readFileSync(filePath, 'utf8');

  if (lang === 'es') {
    const before = content;
    content = applyReplacements(content, esReplacements);
    console.log(`  Encoding fixes: ${before !== content ? 'applied' : 'none'}`);
  } else if (lang === 'pt') {
    const before = content;
    content = applyReplacements(content, ptReplacements);
    console.log(`  Encoding fixes: ${before !== content ? 'applied' : 'none'}`);
  }

  let data;
  try {
    data = JSON.parse(content);
  } catch (e) {
    console.error(`  ERROR: JSON parse failed for ${lang}.json: ${e.message}`);
    return null;
  }

  const allChanges = [];

  if (['es', 'pt', 'ar', 'fr', 'hi', 'ru'].includes(lang)) {
    const keyChanges = addMissingKeys(data, lang);
    allChanges.push(...keyChanges);
  }

  if (['es', 'pt', 'ar', 'fr', 'hi'].includes(lang)) {
    const footerChanges = updateFooter(data, lang);
    allChanges.push(...footerChanges);
  }

  const output = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(filePath, output, 'utf8');

  console.log(`  Changes:`);
  if (allChanges.length === 0) {
    console.log(`    (no changes needed)`);
  } else {
    allChanges.forEach(c => console.log(`    + ${c}`));
  }

  const keyPaths = collectKeyPaths(data);
  console.log(`  Total leaf keys: ${keyPaths.size}`);

  return { lang, data, keyPaths };
}

// ─── Validation ──────────────────────────────────────────────────

function validate() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log('VALIDATION');
  console.log(`${'═'.repeat(60)}\n`);

  const zhPath = path.join(MESSAGES_DIR, 'zh.json');
  const zhData = JSON.parse(fs.readFileSync(zhPath, 'utf8'));
  const zhKeys = collectKeyPaths(zhData);

  console.log(`Reference (zh.json): ${zhKeys.size} leaf keys\n`);

  let allPass = true;

  // 1. Key consistency check
  console.log('--- Key consistency ---');
  for (const lang of ['zh', 'en', 'ru', 'es', 'pt', 'ar', 'fr', 'hi']) {
    const filePath = path.join(MESSAGES_DIR, `${lang}.json`);
    const raw = fs.readFileSync(filePath, 'utf8');

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.log(`  ✗ ${lang}.json: INVALID JSON - ${e.message}`);
      allPass = false;
      continue;
    }

    const keys = collectKeyPaths(data);
    const missing = [...zhKeys].filter(k => !keys.has(k));
    const extra = [...keys].filter(k => !zhKeys.has(k));

    // en and ru have pre-existing extra keys (auth.login.email/emailPlaceholder)
    // — not introduced by this script, acceptable
    const hasPreExistingExtra = lang === 'en' || lang === 'ru';
    const extraAcceptable = hasPreExistingExtra &&
      extra.every(k => k === 'auth.login.email' || k === 'auth.login.emailPlaceholder') &&
      missing.length === 0;

    const status = (missing.length === 0 && (extra.length === 0 || extraAcceptable)) ? '✓ PASS' : '✗ FAIL';
    if (status === '✗ FAIL') allPass = false;

    let msg = `  ${status}  ${lang}.json: ${keys.size} keys`;
    if (missing.length > 0) msg += ` | missing: ${missing.join(', ')}`;
    if (extra.length > 0 && !extraAcceptable) msg += ` | extra: ${extra.join(', ')}`;
    if (extraAcceptable) msg += ` | extra (pre-existing): ${extra.join(', ')}`;
    console.log(msg);
  }

  // 2. Encoding residual check (expanded)
  console.log('\n--- Encoding residual check ---');
  const encodingPatterns = [
    'agr cola', 'm quina', 'sesi n', 'Contrase a', 'Tel fono',
    'Pa s', 'pa s', 'Categor as', 'categor a', 'Log stica',
    'Descripci n', 'Ubicaci n', 'n meros', 'may sculas',
    'Inspecci n', 't cnico', 'da os', 'Mar timo', 'mar timo',
    'a reo', 'vol menes', 'd as', 'r pida', 'm xima',
    'an lisis', 'Jap n', 'Pol tica', 'T rminos', 'Direcci n',
    'D lar', 'Dep sito', 'p gina', 'Endere o', 'Localiza o',
    'Avalia o', 'transa es', 'pre os', 'Usu rio', 'Not cias',
    'n o ', 'N o ', 'informaci n', 'garant a', 'seg n',
    'Puntuaci n', 'Evaluaci n', 'Acci n', 'Recomendaci n',
    'exportaci n', 'importaci n', 'Gesti n', 'M ltiples',
    'com rcio', 'Atrav s', 'miss o', 'obt m', 'chin s',
    'dispon veis', 'localiza es', 't cnica', 'v deo',
    'tend ncias', 'm tuo', 'flex vel', 'prote o',
  ];

  for (const lang of ['es', 'pt']) {
    const raw = fs.readFileSync(path.join(MESSAGES_DIR, `${lang}.json`), 'utf8');
    const found = encodingPatterns.filter(p => raw.includes(p));
    if (found.length > 0) {
      console.log(`  ✗ ${lang}.json: residual patterns found: ${found.join(', ')}`);
      allPass = false;
    } else {
      console.log(`  ✓ ${lang}.json: no residual encoding issues`);
    }
  }

  // 3. Footer key check
  console.log('\n--- Footer key check ---');
  for (const lang of ['es', 'pt', 'ar', 'fr', 'hi']) {
    const data = JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, `${lang}.json`), 'utf8'));
    const hasNew = data.footer.quickLinkRb && data.footer.quickLinkCamda &&
                   data.footer.quickLinkTractorHouse && data.footer.quickLinkAgriaffaires;
    const hasOld = oldFooterKeys.some(k => data.footer[k] !== undefined);
    const status = hasNew && !hasOld ? '✓' : '✗';
    if (status === '✗') allPass = false;
    console.log(`  ${status} ${lang}.json: new keys=${hasNew}, old keys removed=${!hasOld}`);
  }

  // 4. False positive check
  console.log('\n--- False positive check ---');
  for (const lang of ['es', 'pt']) {
    const raw = fs.readFileSync(path.join(MESSAGES_DIR, `${lang}.json`), 'utf8');
    const issues = [];
    if (raw.includes('Altañoportunidad')) issues.push('Altañoportunidad');
    if (raw.includes('Úúltima')) issues.push('Úúltima');
    if (issues.length > 0) {
      console.log(`  ✗ ${lang}.json: false positives found: ${issues.join(', ')}`);
      allPass = false;
    } else {
      console.log(`  ✓ ${lang}.json: no false positives`);
    }
  }

  // 5. JSON validity
  console.log('\n--- JSON validity ---');
  for (const lang of ['zh', 'en', 'ru', 'es', 'pt', 'ar', 'fr', 'hi']) {
    const raw = fs.readFileSync(path.join(MESSAGES_DIR, `${lang}.json`), 'utf8');
    try {
      JSON.parse(raw);
      console.log(`  ✓ ${lang}.json: valid`);
    } catch (e) {
      console.log(`  ✗ ${lang}.json: INVALID - ${e.message}`);
      allPass = false;
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  OVERALL: ${allPass ? '✓ ALL PASS' : '✗ ISSUES FOUND'}`);
  console.log(`${'═'.repeat(60)}\n`);

  return allPass;
}

// ─── Main ────────────────────────────────────────────────────────

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║     i18n Translation Fix Script v2                      ║');
console.log('║     - Encoding fix (es, pt) — comprehensive              ║');
console.log('║     - Missing keys (es, pt, ar, fr, hi, ru)              ║');
console.log('║     - Footer update (es, pt, ar, fr, hi)                 ║');
console.log('╚══════════════════════════════════════════════════════════╝');

for (const lang of ['es', 'pt', 'ar', 'fr', 'hi', 'ru']) {
  processLanguage(lang);
}

const passed = validate();
process.exit(passed ? 0 : 1);
