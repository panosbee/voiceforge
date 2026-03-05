// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — i18n Type Definitions
// Strongly-typed translation keys for Greek/English
// ═══════════════════════════════════════════════════════════════════

export type Locale = 'el' | 'en';

export interface Translations {
  // ── Common ─────────────────────────────────────────────────────
  common: {
    appName: string;
    login: string;
    register: string;
    logout: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    close: string;
    loading: string;
    error: string;
    success: string;
    back: string;
    next: string;
    submit: string;
    search: string;
    yes: string;
    no: string;
    or: string;
    freeSignup: string;
    getStartedFree: string;
    allRightsReserved: string;
    perMonth: string;
    oneTime: string;
    skip: string;
    refresh: string;
    popular: string;
  };

  // ── Landing Page ───────────────────────────────────────────────
  landing: {
    heroTitle: string;
    heroTitleHighlight: string;
    heroSubtitle: string;
    featuresTitle: string;
    features: {
      greekVoice: { title: string; description: string };
      appointments: { title: string; description: string };
      analytics: { title: string; description: string };
      customFlows: { title: string; description: string };
      forwardCalls: { title: string; description: string };
      multiAgent: { title: string; description: string };
    };
    industriesTitle: string;
    industries: {
      lawOffice: string;
      medicalPractice: string;
      dentalClinic: string;
      realEstate: string;
      beautySalon: string;
      accounting: string;
      veterinary: string;
    };
    pricingTitle: string;
    pricingSubtitle: string;
    plans: {
      basic: {
        name: string;
        description: string;
        price: string;
        period: string;
        features: string[];
        cta: string;
        badge: string;
      };
      pro: {
        name: string;
        description: string;
        price: string;
        period: string;
        features: string[];
        cta: string;
        badge: string;
      };
      enterprise: {
        name: string;
        description: string;
        price: string;
        period: string;
        features: string[];
        cta: string;
        badge: string;
        comingSoon: string;
      };
    };
    topupsTitle: string;
    topups: {
      extraLanguage: string;
      extraMinutes: string;
      landingPage: string;
      socialMedia: string;
    };
    ctaTitle: string;
    ctaSubtitle: string;
  };

  // ── Auth Pages ─────────────────────────────────────────────────
  auth: {
    loginTitle: string;
    loginSubtitle: string;
    registerTitle: string;
    registerSubtitle: string;
    email: string;
    password: string;
    confirmPassword: string;
    ownerName: string;
    businessName: string;
    forgotPassword: string;
    noAccount: string;
    hasAccount: string;
    magicLink: string;
    magicLinkSent: string;
    passwordMismatch: string;
    passwordTooShort: string;
    emailInUse: string;
    registerSuccess: string;
    loginSuccess: string;
    logoutSuccess: string;
    devMode: string;
    devModeRegister: string;
    subtitle: string;
    ownerNamePlaceholder: string;
    businessNamePlaceholder: string;
    roleSelection: {
      title: string;
      subtitle: string;
      simpleTitle: string;
      simpleDescription: string;
      simpleFeatures: string[];
      expertTitle: string;
      expertDescription: string;
      expertFeatures: string[];
    };
  };

  // ── Dashboard / Sidebar ────────────────────────────────────────
  dashboard: {
    title: string;
    nav: {
      dashboard: string;
      agents: string;
      flows: string;
      calls: string;
      calendar: string;
      analytics: string;
      settings: string;
    };
    welcome: string;
    goodMorning: string;
    overview: string;
    quickStats: {
      totalCalls: string;
      activeAgents: string;
      avgDuration: string;
      satisfaction: string;
      completed: string;
      avgTime: string;
      appointments: string;
    };
    recentCalls: string;
    allCalls: string;
    noCallsYet: string;
    callsWillAppear: string;
    quickActions: string;
    manageAgents: string;
    callHistory: string;
    plan: string;
  };

  // ── Agents ─────────────────────────────────────────────────────
  agents: {
    title: string;
    description: string;
    createNew: string;
    createAgent: string;
    editAgent: string;
    newAgent: string;
    deleteAgent: string;
    deleteConfirm: string;
    testAgent: string;
    assignNumber: string;
    name: string;
    namePlaceholder: string;
    industry: string;
    selectIndustry: string;
    greeting: string;
    greetingPlaceholder: string;
    status: string;
    voice: string;
    model: string;
    knowledgeBase: string;
    forwardPhone: string;
    forwardPhonePlaceholder: string;
    forwardPhoneHint: string;
    instructions: string;
    instructionsPlaceholder: string;
    noAgents: string;
    noAgentsDescription: string;
    draft: string;
    active: string;
    paused: string;
    errorStatus: string;
    female: string;
    male: string;
    calls: string;
    transfer: string;
    loadError: string;
    deleteError: string;
    deletedSuccess: string;
    updateSuccess: string;
    createSuccess: string;
    updateError: string;
    createError: string;
    settingsTab: string;
    knowledgeBaseTab: string;
    ttsModel: string;
    ttsHint: string;
    llmModel: string;
    llmHint: string;
    testHintConnected: string;
    testHintSaveFirst: string;
    tabs: {
      general: string;
      voice: string;
      knowledge: string;
    };
    supportedLanguages: string;
    supportedLanguagesHint: string;
    languageSelectPlaceholder: string;
    aiKnowledgeWizard: string;
    aiKnowledgeWizardDescription: string;
    aiKnowledgeWizardStart: string;
    aiKnowledgeWizardGenerating: string;
    aiKnowledgeWizardDone: string;
    aiKnowledgeWizardError: string;
    wizardTab: string;
  };

  // ── Assign Number Modal ────────────────────────────────────────
  assignNumber: {
    title: string;
    description: string;
    searchPlaceholder: string;
    searchHint: string;
    noResults: string;
    searchError: string;
    purchaseError: string;
    purchaseSuccess: string;
    searchPrompt: string;
    selected: string;
    connecting: string;
    purchaseAndConnect: string;
    purchaseNote: string;
    connected: string;
    callNowNote: string;
    done: string;
  };

  // ── Calls ──────────────────────────────────────────────────────
  calls: {
    title: string;
    totalCount: string;
    noCalls: string;
    noCallsFound: string;
    tryDifferentFilter: string;
    callsWillAppear: string;
    duration: string;
    status: string;
    caller: string;
    agent: string;
    date: string;
    summary: string;
    sentiment: string;
    allCalls: string;
    completed: string;
    missed: string;
    voicemail: string;
    failed: string;
    page: string;
    of: string;
    previous: string;
    next: string;
    statusLabels: {
      ringing: string;
      in_progress: string;
      completed: string;
      missed: string;
      voicemail: string;
      failed: string;
    };
  };

  // ── Settings ───────────────────────────────────────────────────
  settings: {
    title: string;
    description: string;
    profile: string;
    billing: string;
    integrations: string;
    language: string;
    timezone: string;
    plan: string;
    currentPlan: string;
    upgradePlan: string;
    saveSuccess: string;
    saveError: string;
    businessName: string;
    ownerName: string;
    email: string;
    emailNoChange: string;
    phone: string;
    greece: string;
    cyprus: string;
    price: string;
    account: string;
    statusLabel: string;
    active: string;
    inactive: string;
    elevenLabsAI: string;
    activeStatus: string;
    noAgents: string;
    aiAssistants: string;
    telephony: string;
    connected: string;
    notConfigured: string;
    industryLabel: string;
  };

  // ── Analytics ──────────────────────────────────────────────────
  analytics: {
    title: string;
    description: string;
    totalCalls: string;
    completed: string;
    missed: string;
    avgCallTime: string;
    appointments: string;
    conversionRate: string;
    last30Days: string;
    rate: string;
    bookedViaAI: string;
    callsToAppointments: string;
    total: string;
    minutes: string;
    completionRate: string;
    completedLabel: string;
    missedLabel: string;
    detailedCharts: string;
    chartsDescription: string;
  };

  // ── Error / Loading / Not Found ────────────────────────────────
  errors: {
    appError: string;
    appErrorDescription: string;
    tryAgain: string;
    home: string;
    loadingText: string;
    loadingError: string;
    loadingErrorDescription: string;
    pageNotFound: string;
    pageNotFoundDescription: string;
  };

  // ── Knowledge Base ─────────────────────────────────────────────
  knowledgeBase: {
    title: string;
    description: string;
    document: string;
    documents: string;
    fileTab: string;
    urlTab: string;
    textTab: string;
    dropFiles: string;
    dragOrClick: string;
    urlLabel: string;
    nameOptional: string;
    namePlaceholder: string;
    addUrl: string;
    documentName: string;
    documentNamePlaceholder: string;
    textLabel: string;
    textPlaceholder: string;
    characters: string;
    addText: string;
    fileTooLarge: string;
    uploadSuccess: string;
    uploadError: string;
    urlAdded: string;
    textAdded: string;
    deleted: string;
    deleteError: string;
    noDocuments: string;
    deleteTitle: string;
    fileFormatsHint: string;
  };

  // ── Flows (Expert Mode) ─────────────────────────────────────────
  flows: {
    title: string;
    description: string;
    newFlow: string;
    createFlow: string;
    deleteFlowTitle: string;
    noFlows: string;
    noFlowsDescription: string;
    addAgent: string;
    addFirstAgent: string;
    save: string;
    deployFlow: string;
    flowArchitecture: string;
    noRules: string;
    // Agent card labels
    agentName: string;
    industryCat: string;
    voice: string;
    elevenlabsId: string;
    willCreateOnDeploy: string;
    greeting: string;
    instructions: string;
    instructionsPlaceholder: string;
    greetingPlaceholder: string;
    namePlaceholder: string;
    saveChanges: string;
    knowledgeBaseTitle: string;
    knowledgeBaseHint: string;
    routingRules: string;
    newRule: string;
    ruleCondition: string;
    ruleTransferTo: string;
    ruleMessage: string;
    setAsEntry: string;
    test: string;
    remove: string;
    activeStatus: string;
    rules: string;
    // Routing rule empty states
    addMoreAgentsForRules: string;
    noRulesHandleAll: string;
    conditionPlaceholder: string;
    messagePlaceholder: string;
    // Voice gender
    female: string;
    male: string;
    femaleShort: string;
    maleShort: string;
    // Toast messages
    loadError: string;
    loadFlowError: string;
    flowCreated: string;
    flowCreateError: string;
    deleteConfirm: string;
    deleteConfirmSuffix: string;
    flowDeleted: string;
    flowDeleteError: string;
    defaultInstructions: string;
    defaultGreeting: string;
    agentAdded: string;
    agentAddError: string;
    removeConfirm: string;
    removeConfirmSuffix: string;
    agentRemoved: string;
    agentRemoveError: string;
    agentUpdated: string;
    agentUpdateError: string;
    rulesSaved: string;
    saveError: string;
    needTwoAgents: string;
    deployPartialErrors: string;
    deploySuccess: string;
    deployError: string;
    needOneMoreAgent: string;
    noElevenLabsId: string;
    nameRequired: string;
    flowNamePrompt: string;
  };

  // ── Call Detail ────────────────────────────────────────────────
  callDetail: {
    notFound: string;
    backToCalls: string;
    back: string;
    transcript: string;
    noTranscript: string;
    aiSummary: string;
    details: string;
    agentNumber: string;
    duration: string;
    date: string;
    direction: string;
    inbound: string;
    outbound: string;
    insights: string;
    positive: string;
    negative: string;
    neutral: string;
    category: string;
    appointmentBooked: string;
  };

  // ── Test Widget ────────────────────────────────────────────────
  testWidget: {
    title: string;
    subtitle: string;
    micUnavailable: string;
    micUnavailableDescription: string;
    loadingWidget: string;
    widgetLoadError: string;
    widgetLoadErrorDescription: string;
    widgetActive: string;
    pressButton: string;
    voiceResponse: string;
  };
  // ── Calendar ───────────────────────────────────────────────────
  calendar: {
    title: string;
    description: string;
    today: string;
    monthNames: string[];
    dayNames: string[];
    dayNamesShort: string[];
    noCalls: string;
    callsCount: string;
    callAt: string;
    listenRecording: string;
    noRecording: string;
    viewDetails: string;
    transcript: string;
    summary: string;
    incoming: string;
    outgoing: string;
    duration: string;
    status: string;
    agent: string;
    caller: string;
    closePlayer: string;
    playing: string;
    loadError: string;
    appointmentIcon: string;
  };
  // ── Shared Labels (industries, plans, time) ────────────────────
  shared: {
    industries: Record<string, string>;
    plans: Record<string, { name: string; description: string; price: string }>;
    justNow: string;
    minuteAgo: string;
    minutesAgo: string;
    hourAgo: string;
    hoursAgo: string;
    dayAgo: string;
    daysAgo: string;
  };

  // ── Admin Panel ────────────────────────────────────────────────
  admin: {
    title: string;
    description: string;
    wrongPassword: string;
    connectionError: string;
    enterPassword: string;
    loggingIn: string;
    login: string;
    keyGenerated: string;
    errorPrefix: string;
    confirmReject: string;
    confirmRevoke: string;
    logout: string;
    overview: string;
    pendingRegistrations: string;
    activeKeys: string;
    activeCustomers: string;
    totalCustomers: string;
    registrations: string;
    pending: string;
    approved: string;
    rejected: string;
    keys: string;
    licenseKeys: string;
    active: string;
    pendingActivation: string;
    expired: string;
    statusPending: string;
    statusActive: string;
    statusApproved: string;
    statusExpired: string;
    statusRevoked: string;
    statusRejected: string;
    statusSuspended: string;
    tabRegistrations: string;
    tabKeys: string;
    tabCustomers: string;
    customerRegistrations: string;
    all: string;
    noRegistrations: string;
    fullName: string;
    phone: string;
    afm: string;
    doy: string;
    address: string;
    duration: string;
    date: string;
    approveAndKey: string;
    reject: string;
    noKeys: string;
    key: string;
    customer: string;
    plan: string;
    status: string;
    expiry: string;
    actions: string;
    months: string;
    revoke: string;
    customers: string;
    noCustomers: string;
    company: string;
    licenseExpiry: string;
    registration: string;
    email: string;
    pendingCount: string;
    total: string;
  };

  // ── Registration Page ──────────────────────────────────────────
  register: {
    title: string;
    subtitle: string;
    stepPersonal: string;
    stepBusiness: string;
    stepPlan: string;
    stepConfirm: string;
    submitted: string;
    completePayment: string;
    bankDetails: string;
    bank: string;
    copyIban: string;
    beneficiary: string;
    depositAmount: string;
    nextSteps: string;
    nextStepsItems: string[];
    hasKeyActivate: string;
    firstName: string;
    firstNamePlaceholder: string;
    lastName: string;
    lastNamePlaceholder: string;
    phone: string;
    password: string;
    passwordHint: string;
    confirmPassword: string;
    confirmPasswordPlaceholder: string;
    passwordsMismatch: string;
    companyName: string;
    companyNamePlaceholder: string;
    afm: string;
    afmHint: string;
    afmError: string;
    doy: string;
    doyPlaceholder: string;
    businessAddress: string;
    businessAddressPlaceholder: string;
    popular: string;
    perMonth: string;
    subscriptionDuration: string;
    discount: string;
    total: string;
    summary: string;
    personalInfo: string;
    name: string;
    businessInfo: string;
    companyLabel: string;
    afmLabel: string;
    doyLabel: string;
    addressLabel: string;
    planAndPayment: string;
    planLabel: string;
    durationLabel: string;
    totalLabel: string;
    paymentLabel: string;
    bankTransfer: string;
    submitRegistration: string;
    hasAccount: string;
    hasKey: string;
    activate: string;
    submitError: string;
    submitSuccess: string;
    serverError: string;
    durationMonth1: string;
    durationMonths3: string;
    durationMonths6: string;
    durationMonths12: string;
    monthsLabel: string;
  };

  // ── Activate Page ──────────────────────────────────────────────
  activate: {
    title: string;
    successTitle: string;
    successMessage: string;
    enterKey: string;
    keyLabel: string;
    activateBtn: string;
    activating: string;
    noAccount: string;
    register: string;
    hasAccount: string;
    login: string;
    emailReceived: string;
    enterKeyHere: string;
    plan: string;
    company: string;
    expiresAt: string;
    goToDashboard: string;
    activationError: string;
    serverError: string;
  };

  // ── Onboarding ─────────────────────────────────────────────────
  onboarding: {
    steps: {
      business: string;
      plan: string;
      agent: string;
      test: string;
      number: string;
      review: string;
    };
    stepOf: string;
    // Step Business
    businessTitle: string;
    businessSubtitle: string;
    businessNameLabel: string;
    businessNamePlaceholder: string;
    industryLabel: string;
    industryPlaceholder: string;
    ownerNameLabel: string;
    ownerNamePlaceholder: string;
    emailLabel: string;
    phoneLabel: string;
    timezoneLabel: string;
    timezoneGreece: string;
    timezoneCyprus: string;
    // Step Plan
    planTitle: string;
    planSubtitle: string;
    // Step Agent
    agentTitle: string;
    agentSubtitle1: string;
    agentSubtitle2: string;
    agentNameLabel: string;
    agentNamePlaceholder: string;
    agentNameHint: string;
    voiceLabel: string;
    voiceHint: string;
    greetingLabel: string;
    greetingPlaceholder: string;
    greetingHint: string;
    instructionsLabel: string;
    instructionsPlaceholder: string;
    instructionsHint: string;
    kbOptional: string;
    kbUploadHint: string;
    femaleVoice: string;
    maleVoice: string;
    defaultAgentName: string;
    defaultGreeting: string;
    defaultInstructions: string;
    templateApplied: string;
    instructionsApplied: string;
    // Step Test
    testTitle: string;
    testSubtitle1: string;
    testSubtitle2: string;
    testMicUnavailable: string;
    testMicEnable: string;
    testCreating: string;
    testUpdating: string;
    testWidgetFailed: string;
    testCheckConnection: string;
    testPressButton: string;
    testSpeakGreek: string;
    testWidgetActive: string;
    testPressMic: string;
    testRefresh: string;
    testDevMode: string;
    testDevModeHint: string;
    testCreateBtn: string;
    testFirst: string;
    fillAgentFirst: string;
    agentUpdated: string;
    testAgentCreated: string;
    testAgentError: string;
    testConnectionError: string;
    // Step Number
    numberTitle: string;
    numberSubtitle: string;
    numberSearch: string;
    numberSearchBtn: string;
    numberSearching: string;
    numberNoResults: string;
    numberTryDifferent: string;
    numberPerMonth: string;
    numberSkipNote: string;
    numberSearchError: string;
    // Step Review
    reviewTitle: string;
    reviewSubtitle: string;
    reviewBusiness: string;
    reviewCompanyName: string;
    reviewIndustry: string;
    reviewOwner: string;
    reviewPhone: string;
    reviewTimezone: string;
    reviewPlan: string;
    reviewPrice: string;
    reviewIncludes: string;
    reviewAgent: string;
    reviewAgentName: string;
    reviewVoice: string;
    reviewGreeting: string;
    reviewNumber: string;
    reviewNumberLabel: string;
    reviewCost: string;
    reviewNoNumber: string;
    reviewNextSteps: string;
    reviewStep1: string;
    reviewStep2: string;
    reviewStep3: string;
    reviewStep4: string;
    reviewStep5: string;
    reviewStartBtn: string;
    editBtn: string;
    // Toasts
    accountCreated: string;
    accountCreateError: string;
    agentCreated: string;
    agentCreateError: string;
    numberAcquired: string;
    numberAcquireError: string;
    setupComplete: string;
    unknownError: string;
  };

  // ── Support Chatbot ────────────────────────────────────────────
  supportChat: {
    title: string;
    subtitle: string;
    newChat: string;
    inputPlaceholder: string;
    tryLabel: string;
    greeting: string;
    connectionError: string;
    quickPrompts: {
      howToStart: string;
      haveMedical: string;
      haveLaw: string;
      howKB: string;
      howPhone: string;
      whatPlans: string;
    };
  };

  // ── KB Wizard ──────────────────────────────────────────────────
  kbWizard: {
    question1: string;
    question1Placeholder: string;
    question2: string;
    question2Placeholder: string;
    question3: string;
    question3Placeholder: string;
    question4: string;
    question4Placeholder: string;
    knowledgeFile: string;
    suggestedInstructions: string;
    suggestedGreeting: string;
    applyInstructionsBtn: string;
    createBtn: string;
  };

  // ── Error Boundary ─────────────────────────────────────────────
  errorBoundary: {
    title: string;
    description: string;
    tryAgain: string;
    refreshPage: string;
  };
}
