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
}
