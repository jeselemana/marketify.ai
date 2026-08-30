/**
 * Marketify AI — Centralized Localization & Internationalization (i18n)
 * Supports Azerbaijani ('az') and English ('en') with zero machine translation.
 */

const STORAGE_KEY = "marketify_language";
const DEFAULT_LANGUAGE = "az";
const SUPPORTED_LANGUAGES = new Set(["az", "en"]);

export const TRANSLATIONS = {
  az: {
    // ── Global & Brand ────────────────────────────────────────────────────────
    brand: {
      name: "Marketify AI",
      tagline: "Biznes məqsədini strukturlaşdırılmış strategiyaya çevirir.",
      workspaceName: "Marketify workspace",
      personalAccount: "Şəxsi hesab",
      guestAccount: "Qonaq hesabı",
      homeAriaLabel: "Marketify AI ana səhifə",
    },

    // ── Navigation & Rail ─────────────────────────────────────────────────────
    nav: {
      skipToMain: "Əsas hissəyə keç",
      menu: "Menyu",
      openMenu: "Workspace menyusunu aç",
      closeMenu: "Menyunu bağla",
      home: "Başlanğıc",
      askChat: "Söhbət",
      archive: "Arxiv",
      planner: "Planlaşdırılanlar",
      limits: "İstifadə",
      settings: "Parametrlər",
      newStrategy: "Yeni strategiya",
      newChat: "Yeni söhbət",
      recentWork: "Son işlər",
      chatHistory: "Söhbət tarixçəsi",
      recentWorkEmptyTitle: "Strategiyalar burada görünəcək.",
      recentWorkEmptySubtitle: "Yadda saxladığın işlər bu bölmədə qalır.",
      recentChatsEmptyTitle: "Söhbətlər burada görünəcək.",
      recentChatsEmptySubtitle: "Aparılan müzakirələr bu bölmədə qalır.",
      modeSwitchAria: "İş rejimi",
      modeBuild: "Build",
      modeAsk: "Ask",
      switchToAsk: "Ask rejiminə keç",
      switchToBuild: "Build rejiminə keç",
      modeTooltipBuildToAsk: "Rejim: Build (Ask-a keç)",
      modeTooltipAskToBuild: "Rejim: Ask (Build-ə keç)",
      quickNavAria: "Sürətli naviqasiya",
      mainNavAria: "Əsas naviqasiya",
      workspaceAria: "Workspace",
      shortcuts: "Qısayollar",
      terms: "İstifadə şərtləri",
      privacy: "Məxfilik siyasəti",
      languageToggle: "Dili dəyiş (EN)",
      languageToggleAria: "İnterfeys dilini ingilis dilinə dəyiş",
      themeToggleDark: "Dark Mode-a keç",
      themeToggleLight: "Light Mode-a keç",
    },

    // ── Keyboard Shortcuts ───────────────────────────────────────────────────
    shortcuts: {
      title: "Klaviatura qısayolları",
      subtitle: "{platform} üçün sürətli idarəetmə",
      closeAria: "Qısayollar pəncərəsini bağla",
      hint: "Qısayollar mətn sahəsində yazarkən də işləyir. Bu siyahını açmaq üçün ⌘/Ctrl + / və ya ? bas.",
      or: "və",
      items: {
        newStrategyOrChat: "Yeni strategiya və ya söhbət",
        home: "Başlanğıc",
        archive: "Arxiv",
        planner: "Planlaşdırılanlar",
        settings: "Parametrlər",
        modeToggle: "Build və Ask rejimi arasında keçid",
        toggleMode: "Build və Ask rejimi arasında keçid",
        closeModal: "Bu pəncərəni bağla",
      },
    },

    // ── Build Intake (Home) ──────────────────────────────────────────────────
    intake: {
      kicker: "STRATEGIYA QURUCUSU",
      title: "Biznes məqsədini strategiyaya çevir.",
      subtitle: "Konteksti daxil et. Marketify çatışmayan məqamları dəqiqləşdirir və icraya hazır plan qurur.",
      placeholder: "Məsələn: Bakıda yeni premium coffee shop açırıq. 6 aylıq bazara giriş strategiyası və rəqəmsal marketinq planı lazımdır...",
      submitButton: "Strategiyanı qur",
      submitThinking: "Düşünür…",
      submitAnalyzing: "Təhlil edilir…",
      attachFile: "Fayl əlavə et",
      attachFileTooltip: "PDF, Word, TXT (maks. 10MB)",
      removeFile: "Faylı sil",
      suggestionsTitle: "Hazır nümunələr",
      fileTooLarge: "Fayl ölçüsü 10MB-dan çox ola bilməz.",
      fileInvalidType: "Yalnız PDF, DOCX, TXT və MD faylları dəstəklənir.",
      errorEmptyPrompt: "Zəhmət olmasa biznes məqsədinizi və ya layihənizi təsvir edin.",
    },

    // ── Clarification ────────────────────────────────────────────────────────
    clarification: {
      kicker: "DƏQİQLƏŞDİRMƏ",
      title: "Daha dəqiq strategiya üçün bir neçə sual",
      subtitle: "Marketify konteksti analiz etdi. Aşağıdakı sualları cavablandırmaqla daha uyğun və tətbiq oluna bilən nəticə əldə edəcəksən.",
      questionCounter: "Sual {current} / {total}",
      skipQuestion: "Bu sualı ötür",
      skipAll: "Dərhal strategiyanı qur",
      nextButton: "Növbəti sual",
      finishButton: "Tamamla və Strategiyanı Qur",
      textPlaceholder: "Cavabınızı bura daxil edin və ya əlavə qeyd yazın...",
      customOptionPlaceholder: "Öz variantını yaz...",
      optionOther: "Digər variant",
      generatingStrategy: "Strategiya tərtib olunur…",
    },

    // ── Loading Screen ───────────────────────────────────────────────────────
    loading: {
      title: "Strategiyanız hazırlanır",
      subtitle: "Biznes konteksti analiz edilir, strateji prioritetlər və icra planı tərtib olunur.",
      bgJobNote: "Səhifədən ayrılsanız belə proses fonda davam edəcək və Arxivdə saxlanılacaq.",
      tips: [
        "Biznes konteksti və bazar təhlil edilir…",
        "Hədəf auditoriya və mövqelənmə dəqiqləşdirilir…",
        "Marketinq kanalları və büdcə optimallaşdırılır…",
        "Addım-addım icra və fəaliyyət planı qurulur…",
        "Ölçülə bilən KPI-lar və risklərin idarə olunması təyin edilir…",
        "Yekun strateji sənəd tərtib olunur…",
      ],
    },

    // ── Strategy Workspace ───────────────────────────────────────────────────
    strategy: {
      titlePlaceholder: "Strategiyanın adı",
      versionBadge: "v{version}",
      versionTooltip: "Versiya tarixçəsi",
      statusDraft: "Qaralama",
      statusSaved: "Yadda saxlanıldı",
      statusSaving: "Saxlanılır…",
      statusDirty: "Dəyişikliklər var",
      copyLink: "Keçidi kopyala",
      linkCopied: "Keçid kopyalandı",
      duplicate: "Kopyasını yarat",
      duplicatedToast: "Strategiyanın nüsxəsi yaradıldı.",
      exportMenu: "İxrac et",
      exportPdf: "PDF formatında yüklə",
      exportDocx: "Word (.docx) formatında yüklə",
      exportXls: "Excel (.xls) cədvəli",
      exportCsv: "CSV formatında ixrac",
      exportMarkdown: "Markdown formatında kopyala",
      markdownCopied: "Markdown mətni panoya kopyalandı.",
      pdfGenerating: "PDF hazırlanır…",
      sections: {
        priorities: "01. Strateji Prioritetlər",
        positioning: "02. Mövqelənmə və Bazar Uyğunluğu",
        actionPlan: "03. İcra Mərhələləri",
        kpis: "04. Uğur və KPI Hədəfləri",
        risks: "05. Risklər və Həll Yolları",
        nextSteps: "06. Növbəti Addımlar",
      },
      badges: {
        priority: "Prioritet",
        phase: "Mərhələ {number}",
        target: "Hədəf:",
        expectedOutcome: "Gözlənilən nəticə:",
        risk: "Risk",
        mitigation: "Həll yolu:",
        timeGroupToday: "Bu gün",
        timeGroup48h: "Növbəti 48 saat",
        timeGroupWeek: "Bu həftə",
      },
      actions: {
        addToPlanner: "Planlaşdırılanlara əlavə et",
        addedToPlanner: "Əlavə edildi",
        addAllToPlanner: "Bütün addımları əlavə et",
        askAiAboutStrategy: "AI ilə müzakirə et",
        refineStrategy: "Dəqiqləşdir və Yenilə",
      },
      refinement: {
        title: "Strategiyanı dəqiqləşdir",
        subtitle: "Konkret istiqamət seçin və ya xüsusi dəyişiklik tələbini yazın.",
        options: {
          shorten: "Daha qısa et",
          localize_azerbaijan: "Azərbaycan bazarına uyğunlaşdır",
          think_deeper: "Dərindən təhlil et",
          make_practical: "Daha praktik et",
          budget_optimize: "Büdcəni optimallaşdır",
          custom: "Xüsusi dəqiqləşdirmə",
        },
        customPlaceholder: "Strategiyada nəyi dəyişmək və ya əlavə etmək istəyirsiniz?",
        submitButton: "Dəqiqləşdirməni tətbiq et",
        applying: "Tətbiq edilir…",
      },
      askDrawer: {
        title: "Strategiya üzrə AI məsləhətçi",
        subtitle: "Bu strategiyanın detalları, icra addımları və ya riskləri barədə sual verin.",
        placeholder: "Bu strategiya haqqında sual verin...",
        send: "Göndər",
      },
    },

    // ── Ask Workspace (Chat) ─────────────────────────────────────────────────
    ask: {
      kicker: "AI MƏSLƏHƏTÇİ",
      title: "Marketinq və biznes suallarını araşdır.",
      subtitle: "Rəqibləri analiz et, kampaniya ideyalarını sınaqdan keçir, büdcə və kanalları müqayisə et.",
      modelSelectorLabel: "Model:",
      modelAuto: "Avtomatik",
      modelFlash: "Gemini 3.7 Flash",
      thinkingToggle: "Dərindən düşün",
      searchToggle: "Veb axtarış",
      newChat: "Yeni söhbət",
      clearChatConfirm: "Cari söhbəti sıfırlamaq istədiyinizə əminsiniz?",
      placeholder: "Marketinq sualınızı yazın... (Enter ilə göndər)",
      send: "Göndər",
      attachFile: "Fayl əlavə et",
      attachFileTooltip: "PDF, Word, TXT, Şəkil",
      thinkingProcess: "Düşünmə prosesi",
      hideThinking: "Düşüncəni gizlə",
      showThinking: "Düşüncəni göstər",
      sources: "Mənbələr ({count})",
      webSearchBadge: "Google Axtarış",
      copyMessage: "Kopyala",
      messageCopied: "Kopyalandı",
      regenerate: "Yenidən yarat",
      addToPlanner: "Planlaşdırılana əlavə et",
      reportMessage: "Şikayət et",
      suggestedQuestions: "Tövsiyə olunan suallar",
      exportChat: "Söhbəti ixrac et",
      deleteChatConfirm: "Bu söhbət tarixçəsini silmək istəyirsiniz?",
    },

    // ── Archive ──────────────────────────────────────────────────────────────
    archive: {
      kicker: "İŞ TARİXÇƏSİ",
      title: "Arxiv",
      subtitle: "Bütün saxlanılmış strategiyalar və apardığınız müzakirələr.",
      searchPlaceholder: "Strategiya və ya söhbət axtar...",
      filterAll: "Hamısı",
      filterStrategies: "Strategiyalar",
      filterChats: "Söhbətlər",
      sortRecent: "Ən son",
      sortAlpha: "Əlifba sırası",
      sortOldest: "Ən köhnə",
      updatedAt: "Yeniləndi: {date}",
      versionsCount: "{count} versiya",
      messagesCount: "{count} mesaj",
      emptyAllTitle: "Heç bir qeyd tapılmadı.",
      emptyAllSubtitle: "Yeni strategiya və ya söhbətə başlayaraq işinizi burada saxlaya bilərsiniz.",
      emptyFilterTitle: "Nəticə tapılmadı.",
      emptyFilterSubtitle: "Axtarış sorğusunu dəyişin və ya filtri sıfırlayın.",
      deleteConfirmTitle: "Silinməni təsdiqləyin",
      deleteConfirmBody: '"{title}" silinsin? Bu əməliyyat geri qaytarıla bilməz.',
      cancel: "Ləğv et",
      delete: "Sil",
      deletedToast: "Uğurla silindi.",
      open: "Aç",
    },

    // ── Planner ──────────────────────────────────────────────────────────────
    planner: {
      kicker: "İCRA NƏZARƏTİ",
      title: "Planlaşdırılanlar",
      subtitle: "Strategiyalardan və söhbətlərdən toplanmış icra tapşırıqları.",
      filterAll: "Hamısı ({count})",
      filterActive: "Aktiv ({count})",
      filterCompleted: "Tamamlanan ({count})",
      inputPlaceholder: "Yeni tapşırıq əlavə et... (Enter ilə saxla)",
      groupSelectGeneral: "Ümumi",
      addButton: "Əlavə et",
      emptyTitle: "Hələ heç bir tapşırıq yoxdur.",
      emptySubtitle: "Strategiyalardan və ya söhbətlərdən tapşırıqları bura əlavə edərək icraya başlayın.",
      taskCompletedToast: "Tapşırıq tamamlandı.",
      taskReopenedToast: "Tapşırıq yenidən aktiv edildi.",
      taskDeletedToast: "Tapşırıq silindi.",
      deleteTaskAria: "Tapşırığı sil",
    },

    // ── Limits & Usage ───────────────────────────────────────────────────────
    limits: {
      kicker: "İSTİFADƏ VƏ PLAN",
      title: "İstifadə və Limitlər",
      subtitle: "Cari dövr üçün istifadə statistikası və hesab imkanları.",
      periodToday: "Bu gün",
      periodMonth: "Bu ay",
      periodAllTime: "Bütün dövr",
      buildUsageTitle: "Build Rejimi",
      buildUsageSubtitle: "Strategiya generasiyaları",
      askUsageTitle: "Ask Rejimi",
      askUsageSubtitle: "AI sorğuları",
      contextUsageTitle: "Yaddaş və Kontekst",
      contextUsageSubtitle: "Saxlanılan strategiyalar",
      resetNotice: "Gündəlik limitlər hər gün saat 00:00-da yenilənir.",
      featureBreakdownTitle: "Daxil olan imkanlar",
      features: {
        buildGen: "Tam marketinq strategiyası generasiyası",
        askQueries: "AI ilə operativ sual-cavab və araşdırma",
        exportFormats: "PDF, DOCX, Excel və CSV formatlarında ixrac",
        webSearch: "Veb axtarış və canlı mənbələr",
        memoryHub: "Memory Hub və fərdiləşdirilmiş kontekst",
        unlimitedStorage: "Buludda saxlanılan arxiv və tarixçə",
      },
    },

    // ── Settings ─────────────────────────────────────────────────────────────
    settings: {
      kicker: "WORKSPACE",
      title: "Parametrlər",
      subtitle: "Hesab məlumatlarını, fərdiləşdirməni və interfeys parametrlərini idarə et.",
      guestTitle: "Gedişatını qoruyun",
      guestSubtitle: "Hesabsız istifadə edə bilərsən. Hesab yaratdıqda bu cihazdakı strategiyaların profilinə köçürüləcək və başqa cihazlardan da əlçatan olacaq.",
      guestPanelTitle: "Hesab məcburi deyil",
      guestPanelIntro: "Hazırkı işlərin bu brauzerdə saxlanılır. Cihaz dəyişdikdə itirməmək üçün pulsuz hesab yaratmağı tövsiyə edirik.",
      guestSignupBtn: "Hesab yarat",
      guestLoginBtn: "Daxil ol",
      tabs: {
        account: "Hesab",
        experience: "Fərdiləşdirmə",
        security: "Təhlükəsizlik",
        legal: "Hüquqi & Məxfilik",
      },
      languageSelector: {
        title: "İnterfeys dili",
        intro: "Marketify AI üçün istifadə etmək istədiyiniz dili seçin.",
        az: "Azərbaycan dili",
        en: "English",
        toastChanged: "İnterfeys dili dəyişdirildi.",
      },
      account: {
        title: "Hesab məlumatları",
        intro: "Workspace-də görünən adını və giriş məlumatlarını yenilə.",
        fullName: "Ad və soyad",
        username: "İstifadəçi adı",
        email: "E-poçt",
        saveBtn: "Dəyişiklikləri saxla",
        saving: "Saxlanılır…",
        successToast: "Hesab məlumatları yeniləndi.",
        dangerZoneTitle: "Təhlükəli Zona",
        deleteAccountBtn: "Hesabı sil",
        deleteAccountIntro: "Hesabınızı və bütün məlumatlarınızı 14 günlük təhlükəsizlik müddəti ilə silin.",
      },
      experience: {
        title: "Fərdiləşdirilmiş təcrübə",
        intro: "Brendinizi, sahənizi və cavab üslubunuzu təyin edərək Marketify AI-ın sizin biznesinizə tam uyğunlaşmasını təmin edin.",
        masterTitle: "Fərdiləşdirilmiş cavablar və strategiyalar",
        masterDesc: "Aktiv olduqda Ask söhbətləri və Build rejimi aşağıdakı brend profili, üslub və yaddaş qeydləri əsasında cavab verir.",
        masterToggleTitle: "Fərdiləşdirilmiş cavablar və strategiyalar",
        masterToggleIntro: "Aktiv olduqda Ask söhbətləri və Build rejimi aşağıdakı brend profili, üslub və yaddaş qeydləri əsasında cavab verir.",
        importTitle: "Yaddaş köçür",
        importDesc: "ChatGPT, Claude və ya Gemini-dakı yaddaşınızı və brend məlumatlarınızı Marketify-a birbaşa köçürün.",
        importCardTitle: "Yaddaş köçür",
        importCardIntro: "ChatGPT, Claude və ya Gemini-dakı yaddaşınızı və brend məlumatlarınızı Marketify-a birbaşa köçürün.",
        importBtn: "Yaddaşı köçür",
        profileTitle: "Biznes və brend profili",
        profileDesc: "Hər dəfə şirkətiniz haqqında təkrar məlumat verməmək üçün əsas detalları daxil edin.",
        profileIntro: "Hər dəfə şirkətiniz haqqında təkrar məlumat verməmək üçün əsas detalları daxil edin.",
        brandName: "Brend / Layihə adı",
        brandNamePlaceholder: "Məs: Marketify AI",
        industry: "Fəaliyyət sahəsi / Sənaye",
        industryPlaceholder: "Məs: B2B SaaS, E-ticarət, Kosmetika",
        primaryMarket: "Əsas bazar / Coğrafiya",
        primaryMarketPlaceholder: "Məs: Azərbaycan (Bakı və regionlar)",
        targetAudience: "Hədəf kütlə",
        targetAudiencePlaceholder: "Məs: 20-35 yaş gənclər, startaplar",
        toneTitle: "AI cavab üslubu və tonu",
        toneDesc: "Cavabların və tərtib olunan strategiyaların hansı tonda təqdim olunmasını seçin.",
        toneIntro: "Cavabların və tərtib olunan strategiyaların hansı tonda təqdim olunmasını seçin.",
        tones: {
          professional: {
            name: "Peşəkar və Analitik",
            desc: "Dəqiq biznes arqumentləri, strukturlaşdırılmış təhlil və rəsmi terminlər.",
          },
          creative: {
            name: "Yaradıcı və Cəsarətli",
            desc: "Fərqli marketinq ideyaları, viral konseptlər və təsirli şüarlar.",
          },
          concise: {
            name: "Qısa və İcra Yönümlü",
            desc: "Girişsiz, birbaşa icra addımları, qısa bəndlər və dərhal tətbiq olunan həllər.",
          },
          friendly: {
            name: "Dostcasına və İzahlı",
            desc: "Səmimi dil, anlaşıqlı yanaşma və marketinq terminlərinin sadə izahı.",
          },
          data_driven: {
            name: "Nəticə və Satış Yönümlü",
            desc: "Dönüşüm (conversion), ROAS, satış qıfı və ölçülə bilən KPI fokuslu.",
          },
        },
        customInstructions: "Xüsusi təlimatlar",
        instructionsTitle: "Xüsusi təlimatlar",
        instructionsDesc: "Marketify-ın sizin üçün cavab hazırlayarkən riayət etməli olduğu xüsusi qaydalar.",
        customTitle: "Xüsusi təlimatlar",
        customIntro: "Marketify-ın sizin üçün cavab hazırlayarkən riayət etməli olduğu xüsusi qaydalar.",
        customLabel: "Təlimat mətni",
        customPlaceholder: "Məsələn: Təkliflərdə həmişə büdcəyə qənaətcil rəqəmsal kanalları önə çək. Cavablarda addım-addım icra planı və ölçülə bilən KPI cədvəli təqdim et...",
        memoryTitle: "Memory Hub",
        memoryDesc: "Marketify-ın biznesiniz haqqında yadda saxladığı məlumatları idarə edin.",
        memoryIntro: "Marketify-ın biznesiniz haqqında yadda saxladığı məlumatları idarə edin.",
        memoryBadge: "{count} qeyd",
        memoryFilters: {
          all: "Hamısı",
          preference: "Üstünlüklər",
          constraint: "Məhdudiyyətlər",
          business: "Biznes faktları",
        },
        memoryCategories: {
          business: "Biznes faktı",
          audience: "Auditoriya",
          preference: "Üstünlük",
          constraint: "Məhdudiyyət",
          general: "Qeyd",
        },
        memoryEmpty: "Hələ heç bir yaddaş qeydi saxlanılmayıb.",
        memoryEmptyCategory: "Bu kateqoriyada yaddaş qeydi yoxdur.",
        newMemoryTitle: "Yeni yaddaş qeydi",
        newMemoryHint: "Model üçün qısa və konkret saxlayın",
        newMemoryPlaceholder: "Yeni fakt əlavə et... məs. Biz yalnız B2B şirkətlərlə işləyirik",
        saveMemoryBtn: "Yaddaşı saxla",
        addMemoryActionBtn: "+ Yaddaş əlavə et",
        importInlineBtn: "Başqa AI-dan köçür",
        clearAllMemoriesBtn: "Bütün yaddaşı təmizlə",
        clearMemoriesConfirm: "Bütün yaddaş qeydlərini silmək istədiyinizdən əminsiniz?",
        scopesTitle: "Tətbiq rejimləri",
        scopesDesc: "Fərdiləşdirmənin hansı modullarda işləməsini tənzimləyin.",
        scopesIntro: "Fərdiləşdirmənin hansı modullarda işləməsini tənzimləyin.",
        scopeAskTitle: "Ask",
        scopeAskDesc: "Cari sualınızla bağlı olduqda keçmiş söhbətlər və strategiyalardan faydalı məlumatlar avtomatik cəlb edilir.",
        scopeBuildTitle: "Build",
        scopeBuildDesc: "Yeni strategiya yaradarkən və dəqiqləşdirərkən yuxarıdakı brend profili və ton nəzərə alınır.",
        defaultModeTitle: "İlkin açılış rejimi",
        defaultModeDesc: "Marketify açıldıqda hansı rejimdə başlamasını seçin.",
        defaultModeIntro: "Marketify açıldıqda hansı rejimdə başlamasını seçin.",
        saveBtn: "Dəyişiklikləri saxla",
        modes: {
          build: {
            name: "Build",
            desc: "Marketify açıldıqda birbaşa strukturlaşdırılmış strategiya hazırlamaq rejimini aktiv edin.",
          },
          ask: {
            name: "Ask",
            desc: "Marketify açıldıqda birbaşa AI ilə interaktiv söhbət və operativ sual-cavab rejimini aktiv edin.",
          },
        },
      },
      security: {
        title: "Giriş təhlükəsizliyi",
        intro: "Hesab şifrənizi və aktiv sessiyalarınızı idarə edin.",
        currentPassword: "Cari şifrə",
        newPassword: "Yeni şifrə",
        confirmPassword: "Yeni şifrəni təkrarla",
        updatePasswordBtn: "Şifrəni yenilə",
        changePasswordBtn: "Şifrəni yenilə",
        updatingPassword: "Yenilənir…",
        passwordUpdatedToast: "Şifrəniz uğurla yeniləndi.",
        signOutTitle: "Bu cihazdan çıx",
        signOutDesc: "Marketify sessiyanı təhlükəsiz şəkildə bağlayacaq.",
        signOutBtn: "Çıxış et",
        logoutBtn: "Çıxış et",
        deleteAccountTitle: "Hesabı sil",
        deleteAccountDesc: "Hesabınızı və bütün məlumatlarınızı 14 günlük təhlükəsizlik müddəti ilə silin.",
        deleteAccountBtn: "Hesabı sil",
      },
      legal: {
        title: "Hüquqi məlumatlar və məxfilik",
        intro: "İstifadə qaydaları, məxfilik prinsipləri və əlaqə vasitələri.",
        termsTitle: "İstifadə şərtləri",
        termsDesc: "Platformadan istifadə qaydaları, hüquq və vəzifələr.",
        privacyTitle: "Məxfilik siyasəti",
        privacyDesc: "Məlumatların toplanması, emalı və qorunması prinsipləri.",
        reportTitle: "Problem və ya hüquqi bildiriş göndər",
        reportDesc: "Sistem cavablarında müəllif hüququ, qeyri-etik məzmun və ya texniki nasazlıq gördükdə bizə bildirin.",
        viewTerms: "İstifadə şərtlərini oxu",
        viewPrivacy: "Məxfilik siyasətini oxu",
        reportIssueTitle: "Problem və ya hüquqi bildiriş göndər",
        reportIssueIntro: "Sistem cavablarında müəllif hüququ, qeyri-etik məzmun və ya texniki nasazlıq gördükdə bizə bildirin.",
        issueType: "Problem növü",
        issueTypeSelect: "Problem növünü seçin",
        issueTypes: {
          copyright: "Müəllif hüquqları və əqli mülkiyyət pozuntusu",
          privacy: "Fərdi məlumatlar və məxfilik pozuntusu",
          harmful: "Zərərli, qeyri-etik və ya aldadıcı məzmun",
          incorrect: "Faktiki ciddi səhv və ya dezinformasiya",
          other: "Digər hüquqi və ya texniki problem",
        },
        issueDesc: "Problemin ətraflı təsviri",
        issueDescPlaceholder: "Problemi və rast gəldiyiniz vəziyyəti ətraflı izah edin...",
        issueEmail: "Əlaqə e-poçtunuz (istəyə bağlı)",
        submitReportBtn: "Bildirişi göndər",
        submittingReport: "Göndərilir…",
        reportSuccessToast: "Müraciətiniz qeydə alındı. Təşəkkür edirik!",
      },
    },

    // ── Authentication Screens ───────────────────────────────────────────────
    auth: {
      login: {
        title: "Daxil ol",
        subtitle: "İşlərinizi və yadda saxlanılan strategiyalarınızı idarə edin.",
        identifierLabel: "E-poçt və ya istifadəçi adı",
        passwordLabel: "Şifrə",
        forgotPasswordLink: "Şifrəni unutmusan?",
        submitBtn: "Daxil ol",
        submitting: "Daxil olunur…",
        googleBtn: "Google ilə daxil ol",
        noAccountPrompt: "Hesabın yoxdur?",
        signupLink: "Qeydiyyatdan keç",
      },
      signup: {
        title: "Hesab yarat",
        subtitle: "Pulsuz başlayın. Strategiyalarınızı istənilən cihazdan idarə edin.",
        fullNameLabel: "Ad və soyad",
        usernameLabel: "İstifadəçi adı",
        emailLabel: "E-poçt",
        passwordLabel: "Şifrə",
        passwordRequirements: "Ən azı 10 simvol, hərf və rəqəm daxil olmalıdır.",
        submitBtn: "Qeydiyyatdan keç",
        submitting: "Hesab yaradılır…",
        googleBtn: "Google ilə qeydiyyat",
        hasAccountPrompt: "Artıq hesabın var?",
        loginLink: "Daxil ol",
        termsAgreementPre: "Davam etməklə Marketify-in ",
        termsLink: "istifadə şərtlərini",
        and: " və ",
        privacyLink: "məxfilik siyasətini",
        termsAgreementPost: " qəbul edirsən.",
      },
      forgotPassword: {
        title: "Şifrənin bərpası",
        subtitle: "E-poçt ünvanınızı daxil edin. Şifrəni sıfırlamaq üçün keçid göndərəcəyik.",
        emailLabel: "E-poçt ünvanı",
        submitBtn: "Bərpa linki göndər",
        submitting: "Göndərilir…",
        backToLogin: "Giriş səhifəsinə qayıt",
        sentNotice: "Əgər bu e-poçtla hesab varsa, bərpa linki göndərildi. Gələnlər qutusunu yoxlayın.",
      },
      resetPassword: {
        title: "Yeni şifrə təyin et",
        subtitle: "Hesabınız üçün yeni təhlükəsiz şifrə daxil edin.",
        newPasswordLabel: "Yeni şifrə",
        confirmPasswordLabel: "Yeni şifrənin təkrarı",
        submitBtn: "Şifrəni yenilə",
        submitting: "Yenilənir…",
        successNotice: "Şifrəniz uğurla yeniləndi. İndi yeni şifrənizlə daxil ola bilərsiniz.",
      },
      verifyEmail: {
        title: "E-poçtu təsdiqləyin",
        subtitle: "{email} ünvanına göndərilən 6 rəqəmli təsdiq kodunu daxil edin.",
        codeLabel: "6 rəqəmli təsdiq kodu",
        submitBtn: "Təsdiqlə",
        submitting: "Təsdiqlənir…",
        resendBtn: "Kodu yenidən göndər",
        resendSuccess: "Təsdiq kodu yenidən göndərildi.",
      },
      migration: {
        prompt: "Bu brauzerdəki {count} strategiya hesabınıza köçürülsün?",
        confirmBtn: "Köçür və daxil ol",
        skipBtn: "Köçürmədən davam et",
      },
    },

    // ── Delete Account Modal ─────────────────────────────────────────────────
    deleteAccountModal: {
      title: "Hesabın silinməsini təsdiqləyirsiniz?",
      subtitle: "14 günlük təhlükəsizlik və gözləmə müddəti",
      closeAria: "Bağla",
      callout: "Hesabınız dərhal silinmir. 14 günlük təhlükəsiz gözləmə müddəti tətbiq olunur.",
      rule1Title: "Dərhal deaktivasiya:",
      rule1Desc: "Təsdiq etdiyiniz an cari sessiyanız bağlanacaq və hesabınız təhlükəsiz gözləmə rejiminə keçəcək.",
      rule2Title: "14 gün ərzində avtomatik bərpa:",
      rule2Desc: "14 gün ərzində fikrinizi dəyişsəniz, sadəcə hesabınıza yenidən daxil olmaqla silinməni ləğv edə və hesabınızı tam bərpa edə bilərsiniz.",
      rule3Title: "14 gündən sonra tam silinmə:",
      rule3Desc: "14 gün ərzində daxil olmasanız, bütün strategiyalarınız, söhbətləriniz və fərdi məlumatlarınız bazadan həmişəlik silinəcək.",
      confirmInputLabel: 'Təsdiq üçün "SIL" və ya "DELETE" yazın:',
      confirmInputPlaceholder: "SIL və ya DELETE",
      confirmBtn: "Hesabı deaktiv et və silməyə qoy",
      canceling: "Ləğv edilir…",
      cancelBtn: "İmtina et",
    },

    // ── Common UI / Toasts / Errors ──────────────────────────────────────────
    common: {
      disclaimer: "Marketify səhv edə bilər.",
      save: "Yadda saxla",
      cancel: "Ləğv et",
      delete: "Sil",
      edit: "Redaktə et",
      close: "Bağla",
      copy: "Kopyala",
      copied: "Kopyalandı",
      loading: "Yüklənir…",
      success: "Uğurlu əməliyyat",
      error: "Xəta baş verdi",
      retry: "Yenidən cəhd et",
      back: "Geri",
      continue: "Davam et",
      all: "Hamısı",
      search: "Axtar",
      filter: "Filtr",
      sort: "Sırala",
      actions: "Əməliyyatlar",
      notAvailable: "Mövcud deyil",
      genericError: "Sorğunu tamamlamaq mümkün olmadı. Zəhmət olmasa bir az sonra yenidən cəhd edin.",
      networkError: "İnternet bağlantınızı yoxlayın.",
      sessionExpired: "Sessiyanız bitmişdir. Zəhmət olmasa yenidən daxil olun.",
    },

    // ── Date & Time Format Units ─────────────────────────────────────────────
    time: {
      justNow: "indi",
      minutesAgo: "{count} dəq əvvəl",
      hoursAgo: "{count} saat əvvəl",
      yesterday: "dünən",
      daysAgo: "{count} gün əvvəl",
    },

    // ── Announcement Bar ─────────────────────────────────────────────────────
    announcement: {
      badge: "v3.0",
      message: "Marketify v3.0 istifadənizdədir",
      closeAria: "Elanı bağla",
    },
  },

  en: {
    // ── Global & Brand ────────────────────────────────────────────────────────
    brand: {
      name: "Marketify AI",
      tagline: "Transform business goals into execution-ready marketing strategies.",
      workspaceName: "Marketify Workspace",
      personalAccount: "Personal Account",
      guestAccount: "Guest Workspace",
      homeAriaLabel: "Marketify AI Homepage",
    },

    // ── Navigation & Rail ─────────────────────────────────────────────────────
    nav: {
      skipToMain: "Skip to main content",
      menu: "Menu",
      openMenu: "Open workspace menu",
      closeMenu: "Close menu",
      home: "Home",
      askChat: "Chat",
      archive: "Archive",
      planner: "Planner",
      limits: "Usage",
      settings: "Settings",
      newStrategy: "New Strategy",
      newChat: "New Chat",
      recentWork: "Recent Strategies",
      chatHistory: "Chat History",
      recentWorkEmptyTitle: "No strategies yet",
      recentWorkEmptySubtitle: "Your saved strategies and roadmaps will appear here.",
      recentChatsEmptyTitle: "No conversations yet",
      recentChatsEmptySubtitle: "Your conversation history will appear here.",
      modeSwitchAria: "Workspace mode",
      modeBuild: "Build",
      modeAsk: "Ask",
      switchToAsk: "Switch to Ask mode",
      switchToBuild: "Switch to Build mode",
      modeTooltipBuildToAsk: "Switch to Ask Chat (⌘K)",
      modeTooltipAskToBuild: "Switch to Strategy Builder (⌘K)",
      quickNavAria: "Quick Navigation",
      mainNavAria: "Main navigation",
      workspaceAria: "Workspace",
      shortcuts: "Shortcuts",
      terms: "Terms of Service",
      privacy: "Privacy Policy",
      languageToggle: "Azərbaycan dili (AZ)",
      languageToggleAria: "Switch interface language to Azerbaijani",
      themeToggleDark: "Switch to Dark Mode",
      themeToggleLight: "Switch to Light Mode",
    },

    // ── Keyboard Shortcuts ───────────────────────────────────────────────────
    shortcuts: {
      title: "Keyboard Shortcuts",
      subtitle: "Quick navigation and actions for {platform}",
      closeAria: "Close keyboard shortcuts window",
      hint: "Shortcuts are accessible globally across the workspace. Press ⌘/ or ? anytime.",
      or: "or",
      items: {
        newStrategyOrChat: "New strategy or chat",
        home: "Home",
        archive: "Archive",
        planner: "Planner",
        settings: "Settings",
        modeToggle: "Toggle between Build and Ask modes",
        toggleMode: "Toggle between Build and Ask modes",
        closeModal: "Close dialog or modal",
      },
    },

    // ── Build Intake (Home) ──────────────────────────────────────────────────
    intake: {
      kicker: "STRATEGY BUILDER",
      title: "Turn your business goal into an execution strategy.",
      subtitle: "Describe your product or goal. Marketify identifies strategic gaps and crafts an execution-ready roadmap.",
      placeholder: "e.g. Launching a B2B SaaS analytics tool for e-commerce brands in North America. Need a 6-month go-to-market plan, acquisition channels, and KPI targets...",
      submitButton: "Build Strategy",
      submitThinking: "Thinking…",
      submitAnalyzing: "Analyzing…",
      attachFile: "Attach File",
      attachFileTooltip: "PDF, Word, TXT, MD (up to 10MB)",
      removeFile: "Remove file",
      suggestionsTitle: "Starter Templates",
      fileTooLarge: "File size exceeds 10MB limit.",
      fileInvalidType: "Supported file formats: PDF, DOCX, TXT, and Markdown.",
      errorEmptyPrompt: "Please describe your business goal or project to continue.",
    },

    // ── Clarification ────────────────────────────────────────────────────────
    clarification: {
      kicker: "STRATEGY CLARIFICATION",
      title: "A few quick questions to sharpen your strategy",
      subtitle: "We analyzed your brief. Answering these targeted questions will ensure a tailored, execution-ready strategy.",
      questionCounter: "Question {current} of {total}",
      skipQuestion: "Skip question",
      skipAll: "Skip and build strategy",
      nextButton: "Next Question",
      finishButton: "Generate Strategy",
      textPlaceholder: "Type your answer or provide additional context...",
      customOptionPlaceholder: "Write your own answer...",
      optionOther: "Other option",
      generatingStrategy: "Generating your strategy…",
    },

    // ── Loading Screen ───────────────────────────────────────────────────────
    loading: {
      title: "Generating your marketing strategy",
      subtitle: "Synthesizing market context, strategic positioning, and channel execution roadmap.",
      bgJobNote: "You can safely navigate away — generation continues in the background and saves to your Archive.",
      tips: [
        "Analyzing business model and competitive landscape…",
        "Refining ideal customer profile and positioning…",
        "Optimizing acquisition channels and budget allocation…",
        "Structuring phased 30-60-90 day execution roadmap…",
        "Defining measurable KPIs, metrics, and risk mitigations…",
        "Finalizing strategic documentation…",
      ],
    },

    // ── Strategy Workspace ───────────────────────────────────────────────────
    strategy: {
      titlePlaceholder: "Strategy Title",
      versionBadge: "v{version}",
      versionTooltip: "Version history",
      statusDraft: "Draft",
      statusSaved: "Saved",
      statusSaving: "Saving…",
      statusDirty: "Unsaved changes",
      copyLink: "Copy link",
      linkCopied: "Link copied to clipboard",
      duplicate: "Duplicate",
      duplicatedToast: "Strategy duplicated successfully.",
      exportMenu: "Export",
      exportPdf: "Download PDF",
      exportDocx: "Download Word (.docx)",
      exportXls: "Download Excel (.xls)",
      exportCsv: "Export CSV",
      exportMarkdown: "Copy Markdown",
      markdownCopied: "Markdown copied to clipboard.",
      pdfGenerating: "Generating PDF…",
      sections: {
        priorities: "01. Strategic Priorities",
        positioning: "02. Positioning & Market Fit",
        actionPlan: "03. Execution Roadmap",
        kpis: "04. KPIs & Success Metrics",
        risks: "05. Risks & Mitigations",
        nextSteps: "06. Immediate Next Steps",
      },
      badges: {
        priority: "Priority",
        phase: "Phase {number}",
        target: "Target:",
        expectedOutcome: "Expected Outcome:",
        risk: "Risk",
        mitigation: "Mitigation:",
        timeGroupToday: "Today",
        timeGroup48h: "Next 48 Hours",
        timeGroupWeek: "This Week",
      },
      actions: {
        addToPlanner: "Add to Planner",
        addedToPlanner: "Added",
        addAllToPlanner: "Add all steps to Planner",
        askAiAboutStrategy: "Ask AI about this strategy",
        refineStrategy: "Refine Strategy",
      },
      refinement: {
        title: "Refine Strategy",
        subtitle: "Choose a strategic refinement goal or provide custom instructions.",
        options: {
          shorten: "Make it more concise",
          localize_azerbaijan: "Localize for Azerbaijan market",
          think_deeper: "Deep Strategic Analysis",
          make_practical: "Focus on actionable execution",
          budget_optimize: "Optimize budget & channels",
          custom: "Custom refinement",
        },
        customPlaceholder: "Describe what you would like to adjust, expand, or refine...",
        submitButton: "Apply Refinement",
        applying: "Refining strategy…",
      },
      askDrawer: {
        title: "Strategy Copilot",
        subtitle: "Ask questions about specific execution milestones, channels, budgets, or risks.",
        placeholder: "Ask anything about this strategy...",
        send: "Send",
      },
    },

    // ── Ask Workspace (Chat) ─────────────────────────────────────────────────
    ask: {
      kicker: "AI ADVISOR",
      title: "Strategic Marketing Copilot",
      subtitle: "Explore marketing channels, test campaign ideas, analyze competitors, and model unit economics.",
      modelSelectorLabel: "Model:",
      modelAuto: "Auto",
      modelFlash: "Gemini 3.7 Flash",
      thinkingToggle: "Deep Reasoning",
      searchToggle: "Web Search",
      newChat: "New Chat",
      clearChatConfirm: "Start a new conversation? Your current chat will remain saved in Archive.",
      placeholder: "Ask a marketing question, analyze a competitor, or paste a link... (Enter to send)",
      send: "Send",
      attachFile: "Attach File",
      attachFileTooltip: "PDF, Word, TXT, Images (up to 20MB)",
      thinkingProcess: "Reasoning Process",
      hideThinking: "Hide reasoning",
      showThinking: "Show reasoning",
      sources: "Sources ({count})",
      webSearchBadge: "Google Search",
      copyMessage: "Copy",
      messageCopied: "Copied to clipboard",
      regenerate: "Regenerate",
      addToPlanner: "Add to Planner",
      reportMessage: "Report Issue",
      suggestedQuestions: "Recommended Prompts",
      exportChat: "Export Chat",
      deleteChatConfirm: "Permanently delete this conversation? This cannot be undone.",
    },

    // ── Archive ──────────────────────────────────────────────────────────────
    archive: {
      kicker: "WORK HISTORY",
      title: "Archive",
      subtitle: "All your generated marketing strategies and AI advisory conversations.",
      searchPlaceholder: "Search by title, brief, or keyword...",
      filterAll: "All",
      filterStrategies: "Strategies",
      filterChats: "Chats",
      sortRecent: "Most Recent",
      sortAlpha: "Alphabetical",
      sortOldest: "Oldest",
      updatedAt: "Updated: {date}",
      versionsCount: "{count} versions",
      messagesCount: "{count} messages",
      emptyAllTitle: "No saved items yet",
      emptyAllSubtitle: "Your generated strategies and conversations will appear here automatically.",
      emptyFilterTitle: "No matching results",
      emptyFilterSubtitle: "Try adjusting your search terms or selecting a different filter.",
      deleteConfirmTitle: "Delete Strategy",
      deleteConfirmBody: 'Are you sure you want to delete "{title}"? This action cannot be undone.',
      cancel: "Cancel",
      delete: "Delete",
      deletedToast: "Deleted successfully.",
      open: "Open",
    },

    // ── Planner ──────────────────────────────────────────────────────────────
    planner: {
      kicker: "EXECUTION TRACKER",
      title: "Planner",
      subtitle: "Actionable milestones compiled from your marketing strategies and discussions.",
      filterAll: "All ({count})",
      filterActive: "Active ({count})",
      filterCompleted: "Completed ({count})",
      inputPlaceholder: "Add an execution task... (Press Enter to save)",
      groupSelectGeneral: "General",
      addButton: "Add Task",
      emptyTitle: "No tasks scheduled",
      emptySubtitle: "Add execution items from your strategies or chats to track progress here.",
      taskCompletedToast: "Task marked as completed.",
      taskReopenedToast: "Task marked as active.",
      taskDeletedToast: "Task deleted.",
      deleteTaskAria: "Delete task",
    },

    // ── Limits & Usage ───────────────────────────────────────────────────────
    limits: {
      kicker: "USAGE & LIMITS",
      title: "Usage & Limits",
      subtitle: "Monitor your workspace activity and tier allowances.",
      periodToday: "Today",
      periodMonth: "This Month",
      periodAllTime: "All Time",
      buildUsageTitle: "Strategy Builder",
      buildUsageSubtitle: "Generated & refined strategies",
      askUsageTitle: "Strategic Copilot",
      askUsageSubtitle: "AI queries & research sessions",
      contextUsageTitle: "Knowledge Hub",
      contextUsageSubtitle: "Persisted brand facts & memory",
      resetNotice: "Daily quotas reset at 00:00 UTC.",
      featureBreakdownTitle: "Included Features",
      features: {
        buildGen: "Full-funnel marketing strategy generation",
        askQueries: "Real-time competitive research & strategic advisor",
        exportFormats: "Export to PDF, Word (DOCX), Excel (XLS), and CSV",
        webSearch: "Live market data & grounded Google Web Search",
        memoryHub: "Memory Hub & personalized brand context",
        unlimitedStorage: "Cloud storage for all strategies and conversation history",
      },
    },

    // ── Settings ─────────────────────────────────────────────────────────────
    settings: {
      kicker: "WORKSPACE",
      title: "Settings",
      subtitle: "Manage your account, brand intelligence, and security preferences.",
      guestTitle: "Save Your Progress",
      guestSubtitle: "You can use Marketify as a guest. Creating a free account syncs your strategies across all devices.",
      guestPanelTitle: "Account is Optional",
      guestPanelIntro: "Your work is currently saved locally in this browser. Create a free account to access it anywhere.",
      guestSignupBtn: "Create Free Account",
      guestLoginBtn: "Sign In",
      tabs: {
        account: "Account",
        experience: "Personalization",
        security: "Security",
        legal: "Legal & Privacy",
      },
      languageSelector: {
        title: "Interface Language",
        intro: "Choose your preferred language for Marketify AI.",
        az: "Azərbaycan dili",
        en: "English",
        toastChanged: "Interface language updated.",
      },
      account: {
        title: "Account Details",
        intro: "Update your profile information and credentials.",
        fullName: "Full Name",
        username: "Username",
        email: "Email",
        saveBtn: "Save Changes",
        saving: "Saving…",
        successToast: "Account details updated successfully.",
        dangerZoneTitle: "Danger Zone",
        deleteAccountBtn: "Delete Account",
        deleteAccountIntro: "Permanently delete your account and workspace data with a 14-day recovery window.",
      },
      experience: {
        title: "Personalized Intelligence",
        intro: "Define your brand identity, market positioning, and response style so Marketify tailors every recommendation to your business.",
        masterTitle: "Personalized AI Intelligence",
        masterDesc: "When enabled, Marketify tailors strategies and responses to your brand profile, voice tone, and stored memories.",
        masterToggleTitle: "Personalized AI Intelligence",
        masterToggleIntro: "When enabled, Marketify tailors strategies and responses to your brand profile, voice tone, and stored memories.",
        importTitle: "Import Knowledge & Memory",
        importDesc: "Import brand knowledge and strategic context from other AI assistants directly into Marketify.",
        importCardTitle: "Import Knowledge & Memory",
        importCardIntro: "Import brand knowledge and strategic context from other AI assistants directly into Marketify.",
        importBtn: "Import Memory",
        profileTitle: "Business & Brand Profile",
        profileDesc: "Enter core business details so you never have to repeat context in future prompts.",
        profileIntro: "Enter core business details so you never have to repeat context in future prompts.",
        brandName: "Brand / Company Name",
        brandNamePlaceholder: "e.g. Marketify AI",
        industry: "Industry / Vertical",
        industryPlaceholder: "e.g. B2B SaaS, E-commerce, FinTech",
        primaryMarket: "Primary Market / Geography",
        primaryMarketPlaceholder: "e.g. North America, Global, Azerbaijan",
        targetAudience: "Target Audience",
        targetAudiencePlaceholder: "e.g. Startup founders, Growth marketers, Enterprise leads",
        toneTitle: "AI Persona & Voice",
        toneDesc: "Choose the communication voice and analytical depth for generated strategies and answers.",
        toneIntro: "Choose the communication voice and analytical depth for generated strategies and answers.",
        tones: {
          professional: {
            name: "Executive & Analytical",
            desc: "Structured business logic, data-backed frameworks, and formal strategic terminology.",
          },
          creative: {
            name: "Creative & Bold",
            desc: "Unconventional marketing angles, high-impact hooks, and innovative campaign concepts.",
          },
          concise: {
            name: "Concise & Action-Oriented",
            desc: "Zero fluff, direct bullet points, rapid execution milestones, and immediate takeaways.",
          },
          friendly: {
            name: "Collaborative & Instructive",
            desc: "Approachable tone, step-by-step guidance, and accessible explanations of marketing principles.",
          },
          data_driven: {
            name: "Performance & Conversion-Driven",
            desc: "Focused on conversion rates, ROAS, CAC/LTV economics, and measurable revenue impact.",
          },
        },
        customInstructions: "Custom Instructions",
        instructionsTitle: "Custom Instructions",
        instructionsDesc: "Specific directives and strategic rules Marketify AI must follow in all responses.",
        customTitle: "Custom Instructions",
        customIntro: "Specific rules and instructions Marketify should follow when drafting responses for you.",
        customLabel: "Instruction Text",
        customPlaceholder: "e.g. Always prioritize cost-effective organic channels and provide actionable KPI tables with step-by-step 30-60-90 day milestones...",
        memoryTitle: "Memory Hub",
        memoryDesc: "Manage persistent business facts and strategic preferences stored across your workspace.",
        memoryIntro: "Manage verified business facts and strategic preferences Marketify remembers about your business.",
        memoryBadge: "{count} items",
        memoryFilters: {
          all: "All",
          preference: "Preferences",
          constraint: "Constraints",
          business: "Business Facts",
        },
        memoryCategories: {
          business: "Business Fact",
          audience: "Target Audience",
          preference: "Preference",
          constraint: "Constraint",
          general: "Note",
        },
        memoryEmpty: "No memory items saved yet.",
        memoryEmptyCategory: "No memory items in this category.",
        newMemoryTitle: "New Memory Item",
        newMemoryHint: "Keep it concise and factual for best AI accuracy",
        newMemoryPlaceholder: "Add a fact... e.g. We sell exclusively to B2B enterprise software clients",
        saveMemoryBtn: "Save Memory",
        addMemoryActionBtn: "+ Add Memory",
        importInlineBtn: "Import from Another AI",
        clearAllMemoriesBtn: "Clear All Memory",
        clearMemoriesConfirm: "Are you sure you want to delete all saved memory items?",
        scopesTitle: "Activation Scopes",
        scopesDesc: "Configure which modules actively reference your personalized context and memory.",
        scopesIntro: "Control which modules utilize your personalized context.",
        scopeAskTitle: "Ask Copilot",
        scopeAskDesc: "Automatically retrieves relevant context from past chats and strategies when answering questions.",
        scopeBuildTitle: "Strategy Builder",
        scopeBuildDesc: "Applies your brand profile and tone when creating and refining strategies.",
        defaultModeTitle: "Default Workspace View",
        defaultModeDesc: "Select whether Marketify opens in Strategy Builder or Ask mode by default.",
        defaultModeIntro: "Choose which mode activates when you open Marketify.",
        saveBtn: "Save Changes",
        modes: {
          build: {
            name: "Strategy Builder",
            desc: "Start directly in the structured strategy builder workspace.",
          },
          ask: {
            name: "Strategic Copilot",
            desc: "Start directly in the interactive AI advisor and chat workspace.",
          },
        },
      },
      security: {
        title: "Sign-in & Security",
        intro: "Manage your password and active login sessions.",
        currentPassword: "Current Password",
        newPassword: "New Password",
        confirmPassword: "Confirm New Password",
        updatePasswordBtn: "Update Password",
        changePasswordBtn: "Update Password",
        updatingPassword: "Updating…",
        passwordUpdatedToast: "Password updated successfully.",
        signOutTitle: "Sign Out",
        signOutDesc: "Safely terminate your current session on this device.",
        signOutBtn: "Sign Out",
        logoutBtn: "Log Out",
        deleteAccountTitle: "Delete Account",
        deleteAccountDesc: "Permanently delete your account and associated workspace data with a 14-day recovery period.",
        deleteAccountBtn: "Delete Account",
      },
      legal: {
        title: "Legal & Privacy",
        intro: "Terms of service, privacy practices, and compliance reporting.",
        termsTitle: "Terms of Service",
        termsDesc: "Platform terms, user responsibilities, and intellectual property rights.",
        privacyTitle: "Privacy Policy",
        privacyDesc: "Data collection, processing practices, and security principles.",
        reportTitle: "Report an Issue or Notice",
        reportDesc: "Submit a report regarding copyright, privacy concerns, or unexpected behavior.",
        viewTerms: "Read Terms of Service",
        viewPrivacy: "Read Privacy Policy",
        reportIssueTitle: "Report an Issue / Legal Notice",
        reportIssueIntro: "Report copyright concerns, sensitive content, or system inaccuracies.",
        issueType: "Issue Category",
        issueTypeSelect: "Select issue category",
        issueTypes: {
          copyright: "Copyright or intellectual property infringement",
          privacy: "Personal data or privacy violation",
          harmful: "Harmful, unethical, or misleading content",
          incorrect: "Critical factual inaccuracy or misinformation",
          other: "Other legal or technical issue",
        },
        issueDesc: "Detailed Description",
        issueDescPlaceholder: "Describe the issue and where you encountered it...",
        issueEmail: "Contact Email (optional)",
        submitReportBtn: "Submit Report",
        submittingReport: "Submitting…",
        reportSuccessToast: "Your report has been submitted. Thank you for helping keep Marketify safe.",
      },
    },

    // ── Authentication Screens ───────────────────────────────────────────────
    auth: {
      login: {
        title: "Sign In",
        subtitle: "Access your workspace and saved strategies.",
        identifierLabel: "Email or username",
        passwordLabel: "Password",
        forgotPasswordLink: "Forgot password?",
        submitBtn: "Sign In",
        submitting: "Signing in…",
        googleBtn: "Sign in with Google",
        noAccountPrompt: "Don't have an account?",
        signupLink: "Create account",
      },
      signup: {
        title: "Create Account",
        subtitle: "Start for free. Manage your marketing strategies from any device.",
        fullNameLabel: "Full Name",
        usernameLabel: "Username",
        emailLabel: "Email",
        passwordLabel: "Password",
        passwordRequirements: "At least 10 characters, including letters and numbers.",
        submitBtn: "Create Account",
        submitting: "Creating account…",
        googleBtn: "Sign up with Google",
        hasAccountPrompt: "Already have an account?",
        loginLink: "Sign in",
        termsAgreementPre: "By continuing, you agree to Marketify's ",
        termsLink: "Terms of Service",
        and: " and ",
        privacyLink: "Privacy Policy",
        termsAgreementPost: ".",
      },
      forgotPassword: {
        title: "Reset Password",
        subtitle: "Enter your email address and we will send you a reset link.",
        emailLabel: "Email address",
        submitBtn: "Send Reset Link",
        submitting: "Sending…",
        backToLogin: "Back to sign in",
        sentNotice: "If an account exists for this email, a reset link has been sent. Please check your inbox.",
      },
      resetPassword: {
        title: "Set New Password",
        subtitle: "Enter a strong new password for your account.",
        newPasswordLabel: "New Password",
        confirmPasswordLabel: "Confirm New Password",
        submitBtn: "Update Password",
        submitting: "Updating…",
        successNotice: "Your password has been updated. You can now sign in with your new password.",
      },
      verifyEmail: {
        title: "Verify Your Email",
        subtitle: "Enter the 6-digit verification code sent to {email}.",
        codeLabel: "6-digit verification code",
        submitBtn: "Verify Code",
        submitting: "Verifying…",
        resendBtn: "Resend code",
        resendSuccess: "Verification code resent.",
      },
      migration: {
        prompt: "Transfer {count} strategies from this browser to your account?",
        confirmBtn: "Transfer & Continue",
        skipBtn: "Continue without transferring",
      },
    },

    // ── Delete Account Modal ─────────────────────────────────────────────────
    deleteAccountModal: {
      title: "Confirm Account Deletion",
      subtitle: "14-Day Recovery Window",
      closeAria: "Close",
      callout: "Your account is not permanently erased immediately. A 14-day recovery window is provided.",
      rule1Title: "Immediate Access Revocation:",
      rule1Desc: "Your active session ends immediately and your account enters protected deactivation status.",
      rule2Title: "Effortless 14-Day Restoration:",
      rule2Desc: "Changed your mind? Simply sign in within 14 days to cancel deletion and restore all workspace data.",
      rule3Title: "Permanent Data Erasure:",
      rule3Desc: "After 14 days without login, all strategies, conversations, and account records will be permanently deleted.",
      confirmInputLabel: 'Type "DELETE" or "SIL" to confirm:',
      confirmInputPlaceholder: "DELETE or SIL",
      confirmBtn: "Deactivate & Schedule Deletion",
      canceling: "Canceling…",
      cancelBtn: "Cancel",
    },

    // ── Common UI / Toasts / Errors ──────────────────────────────────────────
    common: {
      disclaimer: "Marketify AI may produce inaccurate information. Verify important strategic decisions.",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      close: "Close",
      copy: "Copy",
      copied: "Copied",
      loading: "Loading…",
      success: "Success",
      error: "An error occurred",
      retry: "Retry",
      back: "Back",
      continue: "Continue",
      all: "All",
      search: "Search",
      filter: "Filter",
      sort: "Sort",
      actions: "Actions",
      notAvailable: "N/A",
      genericError: "Unable to complete request. Please try again in a moment.",
      networkError: "Please check your internet connection.",
      sessionExpired: "Your session has expired. Please sign in again.",
    },

    // ── Date & Time Format Units ─────────────────────────────────────────────
    time: {
      justNow: "just now",
      minutesAgo: "{count}m ago",
      hoursAgo: "{count}h ago",
      yesterday: "yesterday",
      daysAgo: "{count}d ago",
    },

    // ── Announcement Bar ─────────────────────────────────────────────────────
    announcement: {
      badge: "v3.0",
      message: "Marketify v3.0 is now available",
      closeAria: "Dismiss announcement",
    },
  },
};

/**
 * Legal documents in Azerbaijani and English.
 */
export const LEGAL_DOCS_I18N = {
  az: {
    terms: {
      title: "İstifadə Şərtləri",
      subtitle: "Marketify AI platformasının istifadə qaydaları və hüquqi şərtləri",
      html: `
        <div class="legal-highlight-box">
          <strong>✦ Süni İntellekt və API İnfrastrukturu</strong>
          <p>Marketify AI strateji analizlərin, marketinq materiallarının və digər nəticələrin generasiyası üçün süni intellekt, böyük dil modelləri (LLM), API infrastrukturları və digər üçüncü tərəf texnologiyalarından istifadə edə bilər. İstifadə olunan modellər, provayderlər və texniki infrastruktur xidmətin inkişafı ilə əlaqədar dəyişdirilə bilər.</p>
        </div>

        <div class="legal-doc-section">
          <h3>1. Ümumi Müddəalar və Xidmətin Təyinatı</h3>
          <p>Marketify AI platformasına (“Marketify”, “Platforma”, “Xidmət”) xoş gəlmisiniz. Bu İstifadə Şərtləri (“Şərtlər”) Platformaya girişinizi və ondan istifadənizi tənzimləyir. Platformaya daxil olmaqla və ya ondan istifadə etməklə bu Şərtləri oxuduğunuzu, başa düşdüyünüzü və onlara əməl etməyə razı olduğunuzu təsdiq edirsiniz. Şərtlərlə razı deyilsinizsə, Platformadan istifadə etməməlisiniz.</p>
          <p>Marketify süni intellekt texnologiyalarından istifadə etməklə marketinq, biznes strategiyası, bazar analizi, ideya inkişafı, planlaşdırma və əlaqəli sahələr üzrə məzmun və analitik nəticələr yaratmağa kömək edən proqram təminatı platformasıdır.</p>
          <p>Platformanın təqdim etdiyi nəticələr avtomatlaşdırılmış süni intellekt sistemləri tərəfindən generasiya edilir və peşəkar hüquqi, maliyyə, vergi, investisiya və ya digər ixtisaslaşdırılmış məsləhətin əvəzi hesab edilmir.</p>
        </div>

        <div class="legal-doc-section">
          <h3>2. Süni İntellekt Emalı və Üçüncü Tərəf Xidmətləri</h3>
          <p>Platformaya daxil etdiyiniz sorğular, biznes brifləri, mətnlər, fayllar və digər məlumatlar Xidmətin funksiyalarını təmin etmək məqsədilə süni intellekt modelləri, API-lər, hosting, məlumat bazası və digər texniki infrastrukturlar vasitəsilə emal edilə bilər.</p>
          <p>Marketify konkret süni intellekt modelinin, API provayderinin və ya digər üçüncü tərəf xidmətinin daimi mövcudluğuna zəmanət vermir. Marketify istifadə olunan modelləri, provayderləri və texniki infrastrukturu tətbiq olunan qanunvericiliyin tələb etdiyi hallar istisna olmaqla dəyişdirmək hüququnu özündə saxlayır.</p>
        </div>

        <div class="legal-doc-section">
          <h3>3. Süni İntellekt Nəticələrinin Dəqiqliyi</h3>
          <p>Süni intellekt sistemlərinin xüsusiyyətlərinə görə Platforma tərəfindən generasiya olunan nəticələr yanlış, natamam, qeyri-dəqiq və ya köhnəlmiş məlumatlar ehtiva edə bilər. Sistem bəzi hallarda mövcud olmayan faktları, statistik məlumatları, mənbələri və ya digər məlumatları səhvən təqdim edə bilər.</p>
          <p>Marketify generasiya edilən nəticələrin dəqiqliyinə, tamlığına, aktuallığına, etibarlılığına və ya konkret məqsədə uyğunluğuna zəmanət vermir. İstifadəçi mühüm məlumatları müstəqil və etibarlı mənbələrdən yoxlamalıdır.</p>
        </div>

        <div class="legal-doc-section">
          <h3>4. Əqli Mülkiyyət və İstifadəçi Məzmunu</h3>
          <p><strong>İstifadəçi Məzmunu:</strong> Platformaya daxil etdiyiniz biznes məlumatları, ideyalar, briflər, mətnlər, fayllar və digər materiallar üzərində mövcud hüquqlarınız sizdə qalır.</p>
          <p>Marketify-a məlumat təqdim etməklə həmin məlumatların Xidmətin funksiyalarını yerinə yetirmək üçün zəruri həcmdə emal edilməsinə icazə verirsiniz. Platformaya təqdim etdiyiniz məlumatlardan istifadə etmək və onların emalına icazə vermək üçün zəruri hüquq və səlahiyyətlərə malik olduğunuza görə məsuliyyət daşıyırsınız.</p>
          <p><strong>Generasiya Edilən Məzmun:</strong> Qanunvericiliyin və tətbiq olunan üçüncü tərəf şərtlərinin icazə verdiyi həddə Marketify vasitəsilə sizin üçün generasiya edilmiş strategiya, fəaliyyət planı, mətn və digər nəticələrdən kommersiya və qeyri-kommersiya məqsədləri üçün istifadə edə bilərsiniz.</p>
          <p>Süni intellekt sistemlərinin xüsusiyyətlərinə görə eyni və ya oxşar nəticələr digər istifadəçilər üçün də generasiya edilə bilər. Marketify generasiya edilmiş məzmunun unikal, eksklüziv və ya müəllif hüquqları ilə qoruna bilən olmasına zəmanət vermir.</p>
        </div>

        <div class="legal-doc-section">
          <h3>5. Biznes Qərarları və Tövsiyə Xarakteri</h3>
          <p>Marketify tərəfindən generasiya edilən strategiyalar, proqnozlar, bazar təhlilləri, büdcə təklifləri, fəaliyyət planları və digər nəticələr məlumatlandırıcı və yardımçı xarakter daşıyır.</p>
          <p>Marketify müəyyən satış, gəlir, mənfəət, investisiya nəticəsinə, marketinq kampaniyasının uğuruna və ya digər konkret biznes nəticəsinə zəmanət vermir. Platformanın təqdim etdiyi məlumatlara əsaslanan qərarların qəbul edilməsi və həyata keçirilməsi istifadəçinin müstəqil qərarı və məsuliyyətidir.</p>
        </div>

        <div class="legal-doc-section">
          <h3>6. Qadağan Olunmuş İstifadə</h3>
          <p>Platformadan qanunsuz fəaliyyət, fırıldaqçılıq, aldatma, üçüncü şəxslərin hüquqlarının pozulması, zərərli proqramların yayılması, sistemlərə icazəsiz giriş, təhlükəsizlik mexanizmlərinin aşılması və ya Platformanın normal fəaliyyətinə müdaxilə məqsədilə istifadə etmək qadağandır.</p>
          <p>Marketify bu Şərtlərin pozulduğunu əsaslı şəkildə müəyyən etdikdə istifadəçinin Platformaya girişini məhdudlaşdırmaq, müvəqqəti dayandırmaq və ya ləğv etmək hüququnu özündə saxlayır.</p>
        </div>

        <div class="legal-doc-section">
          <h3>7. Xidmətin Mövcudluğu və Dəyişdirilməsi</h3>
          <p>Marketify Platformanın fasiləsiz, səhvsiz və ya hər zaman əlçatan olacağına zəmanət vermir. Texniki xidmət, yeniləmələr, server problemləri, üçüncü tərəf API-lərində nasazlıqlar və Marketify-ın ağlabatan nəzarətindən kənar digər hallar Xidmətin müvəqqəti əlçatmaz olmasına və ya müəyyən funksiyaların işləməməsinə səbəb ola bilər.</p>
          <p>Marketify Platformanın funksiyalarını, interfeysini, süni intellekt modellərini, istifadə limitlərini və digər texniki xüsusiyyətlərini dəyişdirmək, əlavə etmək və ya dayandırmaq hüququnu özündə saxlayır.</p>
        </div>

        <div class="legal-doc-section">
          <h3>8. Zəmanətlərin Məhdudlaşdırılması</h3>
          <p>Qanunvericiliyin icazə verdiyi maksimum həddə Platforma və onun funksiyaları “olduğu kimi” və “mövcud olduğu şəkildə” təqdim edilir.</p>
          <p>Marketify Platformanın konkret məqsədə uyğunluğu, fasiləsiz işləməsi, bütün səhvlərdən azad olması və ya generasiya edilən nəticələrin konkret kommersiya və ya biznes nəticəsi yaradacağı barədə açıq və ya nəzərdə tutulan zəmanət vermir.</p>
        </div>

        <div class="legal-doc-section">
          <h3>9. Məsuliyyətin Məhdudlaşdırılması</h3>
          <p>Qanunvericiliyin icazə verdiyi maksimum həddə Marketify Platformadan istifadə, Platformadan istifadə edə bilməmə və ya generasiya edilmiş nəticələrə əsaslanan qərarlar nəticəsində yaranan dolayı, təsadüfi, xüsusi və ya nəticə etibarilə meydana çıxan zərərlərə, o cümlədən itirilmiş mənfəət, gəlir, biznes imkanı, məlumat və ya reputasiya itkisinə görə məsuliyyət daşımır.</p>
          <p>Bu müddəa tətbiq olunan qanunvericiliklə məhdudlaşdırılması və ya istisna edilməsi mümkün olmayan məsuliyyət hallarını aradan qaldırmır.</p>
        </div>

        <div class="legal-doc-section">
          <h3>10. Hesab və Təhlükəsizlik</h3>
          <p>Hesab funksiyası təqdim edildiyi halda istifadəçi öz giriş məlumatlarının məxfiliyini və təhlükəsizliyini qorumağa görə məsuliyyət daşıyır. İcazəsiz giriş və ya hesab təhlükəsizliyinin pozulmasından şübhələndikdə istifadəçi Marketify-a mümkün qədər tez məlumat verməlidir.</p>
        </div>

        <div class="legal-doc-section">
          <h3>11. Məxfilik və Fərdi Məlumatlar</h3>
          <p>Fərdi məlumatların toplanması, istifadəsi, saxlanması və digər emal əməliyyatları Marketify-ın qüvvədə olan Məxfilik Siyasətinə və tətbiq olunan qanunvericiliyə uyğun həyata keçirilir.</p>
          <p>İstifadəçilər Platformaya xidmətin göstərilməsi üçün zəruri olmayan həssas, məxfi və ya üçüncü şəxslərə aid məlumatları daxil etməməlidirlər.</p>
        </div>

        <div class="legal-doc-section">
          <h3>12. Şərtlərin Dəyişdirilməsi</h3>
          <p>Marketify Platformanın inkişafı, hüquqi tələblər, təhlükəsizlik məsələləri və ya xidmət modelində dəyişikliklərlə əlaqədar bu Şərtləri vaxtaşırı yeniləyə bilər. Əhəmiyyətli dəyişikliklər barədə tətbiq olunan qanunvericiliyin tələb etdiyi hallarda istifadəçilərə uyğun vasitələrlə məlumat verilə bilər.</p>
          <p>Yenilənmiş Şərtlər göstərilən qüvvəyə minmə tarixindən tətbiq edilir.</p>
        </div>

        <div class="legal-doc-section">
          <h3>13. Şərtlərin Ayrı-ayrılıqda Qüvvədə Qalması</h3>
          <p>Bu Şərtlərin hər hansı müddəasının etibarsız və ya icraedilməz hesab edilməsi digər müddəaların etibarlılığına təsir göstərmir.</p>
        </div>

        <div class="legal-doc-section">
          <h3>14. Tətbiq Olunan Qanunvericilik</h3>
          <p>Bu Şərtlər Azərbaycan Respublikasının qanunvericiliyinə uyğun olaraq şərh və tətbiq edilir. İstehlakçıların və digər şəxslərin tətbiq olunan qanunvericiliklə məhdudlaşdırılması mümkün olmayan hüquqları bu Şərtlərlə aradan qaldırılmır.</p>
        </div>

        <div class="legal-doc-note">
          <strong>Vacib qeyd</strong>
          <p>Marketify səhv edə bilər. Vacib məlumatları və Platformanın təqdim etdiyi nəticələri müstəqil və etibarlı mənbələrdən yoxlayın.</p>
        </div>
      `,
    },
    privacy: {
      title: "Məxfilik Siyasəti",
      subtitle: "Fərdi və konfidensial məlumatların toplanması, emalı və mühafizəsi qaydaları",
      html: `
        <div class="legal-doc-section">
          <p>Bu Məxfilik Siyasəti (bundan sonra — «Siyasət») Innova Group Azerbaijan tərəfindən idarə olunan Marketify AI platformasında (bundan sonra — «Platforma», «Xidmət» və ya «Məlumat Sahibi/İdarəçi») fərdi və konfidensial məlumatların toplanması, emalı, saxlanması və mühafizəsi qaydalarını müəyyən edir.</p>
          <p>Platformadan istifadə etməklə İstifadəçi Azərbaycan Respublikasının «Fərdi məlumatlar haqqında» Qanununa uyğun olaraq, öz fərdi məlumatlarının bu Siyasətdə göstərilən şərtlər daxilində toplanmasına və emalına tam razılığını bildirmiş olur.</p>
        </div>

        <div class="legal-doc-section">
          <h3>1. Əsas Prinsiplər və Qeyri-Kommersiya Xarakteri</h3>
          <p>1.1. Platforma qeyri-kommersiya təyinatlı fəaliyyət göstərir və toplanan məlumatlardan birbaşa və ya dolayısı ilə kommersiya, reklam və ya mənfəət əldə etmək məqsədilə istifadə etmir.</p>
          <p>1.2. Məlumatların emalı qanunilik, konfidensiallıq, məqsədəuyğunluq və yalnız xidmətin texniki-funksional tələbləri ilə məhdudlaşma prinsiplərinə əsaslanır.</p>
        </div>

        <div class="legal-doc-section">
          <h3>2. Toplanan Məlumatların Kateqoriyaları</h3>
          <p>Platforma xidmətlərin təmənnasız göstərilməsi və sistem təhlükəsizliyinin təmin edilməsi məqsədilə aşağıdakı kateqoriyalar üzrə məlumatları emal edir:</p>
          <p><strong>2.1. İdentifikasiya və Giriş Məlumatları:</strong> İstifadəçinin adı, soyadı, istifadəçi adı, elektron poçt ünvanı və təhlükəsiz şifrələnmiş (kriptoqrafik heşlənmiş) autentifikasiya identifikatorları.</p>
          <p><strong>2.2. Biznes və Məzmun Konteksti:</strong> İstifadəçi tərəfindən sistemə daxil edilən marketinq brifləri, aydınlaşdırma sorğularına cavablar, generasiya olunmuş analitik nəticələr, söhbət tarixçəsi, planlaşdırılan tapşırıqlar və arxiv qeydləri.</p>
          <p><strong>2.3. Texniki və Təhlükəsizlik Göstəriciləri:</strong> İstifadəçinin brauzer sessiya açarları, IP ünvanları, sistem hadisələrinin qeydiyyat jurnalları (server logları) və giriş vaxtı göstəriciləri.</p>
        </div>

        <div class="legal-doc-section">
          <h3>3. Fərdiləşdirilmiş Təcrübə, Həssas Məlumatlar və İstifadəçinin Mülahizə Öhdəliyi</h3>
          <p><strong>3.1. Könüllü Razılıq və Fərdiləşdirmə:</strong> Platformada süni intellekt cavablarının daha dəqiq, kontekstə uyğun və effektiv formalaşdırılması məqsədilə «Fərdiləşdirilmiş təcrübə» funksiyası tətbiq olunur. Bu funksiya yalnız İstifadəçinin birmənalı və könüllü razılığı (opt-in) əsasında aktivləşdirilir və istənilən vaxt sistem parametrlərindən söndürülə bilər.</p>
          <p><strong>3.2. Həssas Məlumatların Yaddaşda Saxlanılmaması:</strong> Fərdiləşdirmə mexanizmi çərçivəsində İstifadəçinin həssas və birbaşa identifikasiyaedici şəxsi məlumatları, o cümlədən mobil telefon nömrəsi, dəqiq yaşayış ünvanı məlumatları, şəxsiyyəti təsdiq edən sənədin fərdi identifikasiya nömrəsi (FİN kod), seriya və nömrəsi, habelə bank və ödəniş rekvizitləri qəti şəkildə fərdiləşdirmə yaddaşında saxlanılmır və profil kontekstinə daxil edilmir. Fərdiləşdirmə yalnız qeyri-həssas, ümumi üslub və marketinq konteksti parametrlərini əhatə edir.</p>
          <p><strong>3.3. İstifadəçinin Mülahizəsi və Paylaşmamaq Məsuliyyəti:</strong> Qanunvericilikdə və ya xidmətin qeydiyyat formasında birbaşa tələb olunan məcburi texniki hallar (məsələn, hesabın yaradılması üçün e-poçt ünvanı) istisna olmaqla, sorğulara daxil edilən hər hansı məlumatın həcmi və xarakteri üzrə yekun mülahizə tam şəkildə İstifadəçinin öz üzərindədir. İstifadəçilər platformanın heç bir interfeysində, sorğu və ya brif daxiletmə sahələrində həssas fərdi məlumatlarını, dövlət qeydiyyat nömrələrini, bank rekvizitlərini və ya üçüncü şəxslərin gizli məlumatlarını heç bir halda paylaşmamalı və sistemə daxil etməməlidirlər. İstifadəçinin bu tələbə zidd olaraq öz təşəbbüsü ilə paylaşdığı həssas məlumatlara görə Platforma heç bir maddi və ya hüquqi məsuliyyət daşımır.</p>
        </div>

        <div class="legal-doc-section">
          <h3>4. Süni İntellekt API İnteqrasiyası və Məlumatların Transsərhəd Emalı</h3>
          <p>4.1. Platforma strateji təhlil və mətn generasiyası funksiyalarını yerinə yetirmək üçün etibarlı qlobal süni intellekt provayderlərinin rəsmi Tətbiqi Proqramlaşdırma İnterfeyslərindən (API) istifadə edir.</p>
          <p>4.2. Sorğular təhlükəsiz TLS/HTTPS şifrələmə protokolları vasitəsilə ötürülür və yalnız cari generasiya sessiyasının tələblərini icra etmək üçün emal olunur.</p>
          <p>4.3. <strong>Model Təlimindən İmtiyaz:</strong> İstifadəçinin daxil etdiyi biznes sorğuları, fərdi məlumatları və ya fərdiləşdirmə parametrləri üçüncü tərəf süni intellekt modellərinin açıq təlimi (public training) üçün istifadə edilmir.</p>
          <p>4.4. <strong>Məlumatların Satılmaması Təminatı:</strong> Innova Group Azerbaijan heç bir halda istifadəçilərin şəxsi identifikasiya məlumatlarını, əlaqə vasitələrini və ya biznes kontekstini reklam şirkətlərinə, marketinq agentliklərinə və ya digər kommersiya qurumlarına satmır, icarəyə vermir və ötürmür.</p>
        </div>

        <div class="legal-doc-section">
          <h3>5. Məlumatların Saxlanması, İnfrastruktur və Təhlükəsizlik</h3>
          <p>5.1. Məlumatların bütövlüyü və konfidensiallığı müasir bulud saxlanc infrastrukturları (Cloudflare R2), operativ keşləmə mexanizmləri (Redis) və gücləndirilmiş server mühiti vasitəsilə təmin edilir.</p>
          <p>5.2. Məlumat bazalarına icazəsiz girişin, məlumat sızmasının və ya dəyişdirilməsinin qarşısını almaq üçün Azərbaycan Respublikasının «İnformasiya, informasiyalaşdırma və informasiyanın mühafizəsi haqqında» Qanununun tələblərinə uyğun təşkilati və proqram-texniki mühafizə tədbirləri tətbiq olunur.</p>
        </div>

        <div class="legal-doc-section">
          <h3>6. İstifadəçinin Hüquqları və Məlumatların Silinməsi</h3>
          <p>Azərbaycan Respublikasının «Fərdi məlumatlar haqqında» Qanununa əsasən, İstifadəçi aşağıdakı hüquqlara malikdir:</p>
          <p>6.1. Öz fərdi məlumatlarının emal edilib-edilməməsi barədə məlumat almaq və onların tərkibi ilə tanış olmaq;</p>
          <p>6.2. Saxlanılan marketinq strategiyalarını, söhbət tarixçəsini, planlaşdırılan tapşırıqları və fərdiləşdirmə yaddaşını platformanın daxili interfeysi vasitəsilə istənilən vaxt tamamilə və bərpa olunmaz şəkildə silmək;</p>
          <p>6.3. «Fərdiləşdirilmiş təcrübə» funksiyasına verdiyi razılığı istədiyi an geri çağırmaq və sistemdəki profilinin tam ləğv edilməsini (unudulma hüququnu) tələb etmək.</p>
        </div>

        <div class="legal-doc-section">
          <h3>7. Siyasətin Dəyişdirilməsi</h3>
          <p>7.1. Innova Group Azerbaijan qanunvericilikdəki dəyişikliklər və ya platformanın texniki təkamülü ilə əlaqədar bu Siyasətə birtərəfli qaydada dəyişikliklər etmək hüququnu özündə saxlayır.</p>
          <p>7.2. Yenilənmiş Siyasət Platformada dərc edildiyi andan qüvvəyə minir.</p>
        </div>

        <div class="legal-doc-section">
          <h3>8. Əlaqə və Müraciətlər</h3>
          <p>Fərdi məlumatların emalı, məxfilik hüquqlarının həyata keçirilməsi və ya bu Siyasətlə bağlı müraciətlər üçün İstifadəçilər Platformanın rəsmi əks-əlaqə kanalları və rəqəmsal dəstək interfeysi vasitəsilə əlaqə saxlaya bilərlər.</p>
        </div>
      `,
    },
  },
  en: {
    terms: {
      title: "Terms of Service",
      subtitle: "Terms and conditions governing access to and use of Marketify AI",
      html: `
        <div class="legal-highlight-box">
          <strong>✦ Artificial Intelligence & API Infrastructure</strong>
          <p>Marketify AI may utilize artificial intelligence, large language models (LLMs), API infrastructures, and other third-party technologies to generate strategic analyses, marketing materials, and other outputs. The models, providers, and technical infrastructure employed may evolve and change in connection with ongoing service development.</p>
        </div>

        <div class="legal-doc-section">
          <h3>1. General Provisions & Purpose of Service</h3>
          <p>Welcome to Marketify AI ("Marketify", "Platform", "Service"). These Terms of Service ("Terms") govern your access to and use of the Platform. By accessing or using the Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree with these Terms, you must not access or use the Platform.</p>
          <p>Marketify is a software platform that leverages artificial intelligence technologies to assist in creating content and analytical insights across marketing, business strategy, market research, ideation, execution planning, and related disciplines.</p>
          <p>Outputs provided by the Platform are generated by automated artificial intelligence systems and do not constitute professional legal, financial, tax, investment, or other specialized advice.</p>
        </div>

        <div class="legal-doc-section">
          <h3>2. AI Processing & Third-Party Services</h3>
          <p>Queries, business briefs, text, files, and other materials you input into the Platform may be processed through AI models, APIs, hosting environments, databases, and related technical infrastructures to deliver the Service's functionality.</p>
          <p>Marketify does not guarantee the continuous or uninterrupted availability of any specific AI model, API provider, or third-party service. Marketify reserves the right to modify or replace underlying models, providers, and technical infrastructure, except where prohibited by applicable law.</p>
        </div>

        <div class="legal-doc-section">
          <h3>3. Accuracy of AI Outputs</h3>
          <p>Due to the inherent characteristics of artificial intelligence systems, outputs generated by the Platform may contain inaccurate, incomplete, misleading, or outdated information. In certain instances, the system may erroneously present non-existent facts, statistics, citations, or data.</p>
          <p>Marketify makes no warranties or representations regarding the accuracy, completeness, timeliness, reliability, or fitness for a particular purpose of any generated output. Users are advised to independently verify critical information from trusted sources.</p>
        </div>

        <div class="legal-doc-section">
          <h3>4. Intellectual Property & User Content</h3>
          <p><strong>User Content:</strong> You retain all existing rights and ownership over the business data, concepts, briefs, text, files, and other materials you input into the Platform.</p>
          <p>By submitting materials to Marketify, you grant the Platform permission to process such data to the extent necessary to deliver the Service. You represent and warrant that you possess all necessary rights and authorizations to submit and permit processing of such information.</p>
          <p><strong>Generated Content:</strong> To the maximum extent permitted by applicable law and third-party terms, you may utilize the strategies, action roadmaps, copy, and analytical outputs generated for you through Marketify for commercial and non-commercial purposes.</p>
          <p>Due to the operational nature of AI systems, identical or similar outputs may be generated for other users. Marketify does not warrant that generated content is unique, exclusive, or protectable under copyright law.</p>
        </div>

        <div class="legal-doc-section">
          <h3>5. Business Decisions & Advisory Nature</h3>
          <p>Strategies, forecasts, market analyses, budget suggestions, action plans, and other outputs generated by Marketify are strictly informational and advisory in nature.</p>
          <p>Marketify does not guarantee specific sales figures, revenue, profit margins, investment returns, campaign success, or any particular business outcome. Any decision made or implemented based on information provided by the Platform is the sole discretion and responsibility of the user.</p>
        </div>

        <div class="legal-doc-section">
          <h3>6. Prohibited Use</h3>
          <p>You agree not to use the Platform for unlawful activities, fraud, deception, infringement of third-party rights, dissemination of malicious software, unauthorized system access, circumvention of security controls, or disruption of Platform operations.</p>
          <p>Marketify reserves the right to restrict, suspend, or terminate access to the Platform if it reasonably determines that these Terms have been violated.</p>
        </div>

        <div class="legal-doc-section">
          <h3>7. Service Availability & Modifications</h3>
          <p>Marketify does not warrant that the Platform will be uninterrupted, error-free, or continuously accessible. Scheduled maintenance, system updates, server issues, third-party API outages, and circumstances beyond Marketify’s reasonable control may result in temporary unavailability or degraded functionality.</p>
          <p>Marketify reserves the right to alter, enhance, limit, or discontinue Platform features, interfaces, AI models, usage limits, and other technical capabilities.</p>
        </div>

        <div class="legal-doc-section">
          <h3>8. Disclaimer of Warranties</h3>
          <p>To the maximum extent permitted by applicable law, the Platform and its features are provided on an "as is" and "as available" basis.</p>
          <p>Marketify disclaims all warranties, express or implied, including warranties of fitness for a particular purpose, uninterrupted operation, absence of errors, or that generated outputs will achieve any specific commercial or business result.</p>
        </div>

        <div class="legal-doc-section">
          <h3>9. Limitation of Liability</h3>
          <p>To the maximum extent permitted by applicable law, Marketify shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, revenue, business opportunities, data, or reputation arising out of or in connection with your use of or inability to use the Platform or reliance on generated outputs.</p>
          <p>Nothing in this section excludes or limits liability that cannot be excluded or limited under applicable law.</p>
        </div>

        <div class="legal-doc-section">
          <h3>10. Accounts & Security</h3>
          <p>Where account functionality is provided, you are responsible for maintaining the confidentiality and security of your access credentials. You must notify Marketify promptly upon suspecting unauthorized access or a security breach.</p>
        </div>

        <div class="legal-doc-section">
          <h3>11. Privacy & Personal Data</h3>
          <p>The collection, use, retention, and processing of personal data are conducted in accordance with Marketify’s active Privacy Policy and applicable data protection legislation.</p>
          <p>Users must refrain from submitting sensitive personal data, classified information, or third-party confidential details not required for the provision of the Service.</p>
        </div>

        <div class="legal-doc-section">
          <h3>12. Amendments to Terms</h3>
          <p>Marketify may update these Terms periodically to reflect platform development, legal requirements, security standards, or service model updates. Where required by law, users will be notified of material changes through appropriate channels.</p>
          <p>Updated Terms take effect as of the specified effective date.</p>
        </div>

        <div class="legal-doc-section">
          <h3>13. Severability</h3>
          <p>If any provision of these Terms is found to be invalid, illegal, or unenforceable, the validity and enforceability of the remaining provisions shall remain in full force and effect.</p>
        </div>

        <div class="legal-doc-section">
          <h3>14. Governing Law & Jurisdiction</h3>
          <p>These Terms are governed by and construed in accordance with the laws of the Republic of Azerbaijan. Statutory consumer protections and rights that cannot be waived under applicable law remain unaffected.</p>
        </div>

        <div class="legal-doc-note">
          <strong>Important Notice</strong>
          <p>Marketify AI may make mistakes. Verify important information and platform-generated outputs from independent and reliable sources.</p>
        </div>

        <div class="legal-doc-precedence">
          <p><strong>Governing Language Precedence:</strong> This document is translated from the original Azerbaijani version for convenience. In the event of any conflict, discrepancy, ambiguity, or dispute between this English translation and the original Azerbaijani text, the original Azerbaijani version shall govern and prevail.</p>
        </div>
      `,
    },
    privacy: {
      title: "Privacy Policy",
      subtitle: "Rules and standards for the collection, processing, retention, and protection of personal and confidential data",
      html: `
        <div class="legal-doc-section">
          <p>This Privacy Policy (hereinafter "Policy") defines the rules for collecting, processing, storing, and protecting personal and confidential data on the Marketify AI platform (hereinafter "Platform", "Service", or "Data Controller"), operated by Innova Group Azerbaijan.</p>
          <p>By using the Platform, the User provides full consent to the collection and processing of their personal data within the terms outlined in this Policy, in accordance with the Law of the Republic of Azerbaijan "On Personal Data".</p>
        </div>

        <div class="legal-doc-section">
          <h3>1. Core Principles & Non-Commercial Nature</h3>
          <p>1.1. The Platform operates on a non-commercial basis and does not directly or indirectly use collected data for advertising, commercial monetization, or profit generation.</p>
          <p>1.2. Data processing is strictly governed by principles of legality, confidentiality, purpose limitation, and restriction to the technical and functional requirements of the Service.</p>
        </div>

        <div class="legal-doc-section">
          <h3>2. Categories of Collected Data</h3>
          <p>To provide free services and maintain system security, the Platform processes data across the following categories:</p>
          <p><strong>2.1. Identification & Authentication Data:</strong> User's first name, last name, username, email address, and securely hashed cryptographic authentication identifiers.</p>
          <p><strong>2.2. Business & Content Context:</strong> User-submitted marketing briefs, clarification responses, generated analytical outputs, conversation history, planner tasks, and archive records.</p>
          <p><strong>2.3. Technical & Security Telemetry:</strong> Browser session tokens, IP addresses, system audit event logs (server logs), and timestamp records.</p>
        </div>

        <div class="legal-doc-section">
          <h3>3. Personalized Experience, Sensitive Data & User Discretion</h3>
          <p><strong>3.1. Voluntary Consent & Personalization:</strong> The Platform includes a "Personalized Intelligence" feature to formulate more accurate, contextually relevant, and effective AI responses. This feature is enabled strictly with the User’s explicit, voluntary opt-in consent and may be deactivated at any time via system settings.</p>
          <p><strong>3.2. Exclusion of Sensitive Personal Data:</strong> Under the personalization mechanism, sensitive and directly identifiable personal information—including mobile telephone numbers, precise residential addresses, government identification numbers (FIN codes, series and document numbers), and banking or payment details—is strictly prohibited from storage in personalization memory and excluded from profile context. Personalization encompasses only non-sensitive stylistic preferences and marketing context parameters.</p>
          <p><strong>3.3. User Discretion & Non-Disclosure Obligation:</strong> Except for mandatory technical fields required by law or account registration (e.g., email address), the volume and nature of information submitted in queries is solely at the User's discretion. Users must not enter sensitive personal data, state registration numbers, banking credentials, or third-party confidential secrets into any input field, brief form, or interface. The Platform assumes no financial or legal liability for sensitive information submitted by the User contrary to this requirement.</p>
        </div>

        <div class="legal-doc-section">
          <h3>4. AI API Integration & Cross-Border Processing</h3>
          <p>4.1. The Platform utilizes official Application Programming Interfaces (APIs) of trusted global AI providers to perform strategic analysis and text generation.</p>
          <p>4.2. Requests are transmitted via secure TLS/HTTPS encryption protocols and processed exclusively to fulfill the active generation session.</p>
          <p>4.3. <strong>No Model Training:</strong> User-submitted business queries, personal data, and personalization parameters are never used to train public third-party AI foundation models.</p>
          <p>4.4. <strong>Non-Sale Guarantee:</strong> Innova Group Azerbaijan never sells, rents, or transfers personal identification data, contact details, or business context to advertising agencies, marketing brokers, or commercial entities.</p>
        </div>

        <div class="legal-doc-section">
          <h3>5. Data Storage, Infrastructure & Security</h3>
          <p>5.1. Data integrity and confidentiality are safeguarded using modern cloud storage infrastructure (Cloudflare R2), high-speed caching mechanisms (Redis), and hardened server environments.</p>
          <p>5.2. Organizational and technical security measures are deployed in compliance with the Law of the Republic of Azerbaijan "On Information, Informatization, and Information Protection" to prevent unauthorized database access, data leaks, or tampering.</p>
        </div>

        <div class="legal-doc-section">
          <h3>6. User Rights & Data Deletion</h3>
          <p>Under the Law of the Republic of Azerbaijan "On Personal Data", Users have the right to:</p>
          <p>6.1. Obtain confirmation and information regarding whether their personal data is being processed, including its composition;</p>
          <p>6.2. Permanently and irreversibly delete stored marketing strategies, chat histories, planner tasks, and personalization memory directly through the platform interface at any time;</p>
          <p>6.3. Withdraw consent for the "Personalized Intelligence" feature at any moment and request complete account deactivation and erasure (right to be forgotten).</p>
        </div>

        <div class="legal-doc-section">
          <h3>7. Policy Modifications</h3>
          <p>7.1. Innova Group Azerbaijan reserves the right to unilaterally update this Policy in response to statutory changes or technical evolutions of the Platform.</p>
          <p>7.2. The updated Policy takes effect immediately upon publication on the Platform.</p>
        </div>

        <div class="legal-doc-section">
          <h3>8. Contact & Inquiries</h3>
          <p>For inquiries regarding personal data processing, privacy rights, or this Policy, Users may reach out through the Platform’s official feedback channels and digital support interface.</p>
        </div>

        <div class="legal-doc-precedence">
          <p><strong>Governing Language Precedence:</strong> This document is translated from the original Azerbaijani version for convenience. In the event of any conflict, discrepancy, ambiguity, or dispute between this English translation and the original Azerbaijani text, the original Azerbaijani version shall govern and prevail.</p>
        </div>
      `,
    },
  },
};

/**
 * Get active language code ('az' or 'en').
 */
export function getLanguage() {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.has(stored)) {
      return stored;
    }
  } catch {}
  return DEFAULT_LANGUAGE;
}

/**
 * Set active language code and dispatch change event.
 * @param {'az' | 'en'} [lang]
 * @param {boolean} [persist=true]
 */
export function setLanguage(lang, persist = true) {
  const target = SUPPORTED_LANGUAGES.has(lang) ? lang : DEFAULT_LANGUAGE;
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, target);
    } catch {}
  }
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.lang = target;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("marketify:language-change", { detail: { language: target } }));
  }
  return target;
}

/**
 * Lookup a localized string by key with dot-notation and parameter replacement.
 * Example: t('strategy.versionBadge', { version: 2 })
 * @param {string} key
 * @param {Record<string, any>} [params]
 * @param {string} [lang]
 * @returns {string}
 */
export function t(key, params = {}, lang = null) {
  const currentLang = lang && SUPPORTED_LANGUAGES.has(lang) ? lang : getLanguage();
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS[DEFAULT_LANGUAGE];
  const fallbackDict = TRANSLATIONS[DEFAULT_LANGUAGE];

  const value = resolveKey(dict, key) ?? resolveKey(fallbackDict, key) ?? key;

  if (typeof value !== "string") {
    return String(value ?? key);
  }

  return interpolate(value, params);
}

function resolveKey(obj, path) {
  if (!obj || typeof obj !== "object") return null;
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }
  return current;
}

function interpolate(text, params) {
  if (!params || typeof params !== "object") return text;
  return text.replace(/\{(\w+)\}/g, (match, paramName) => {
    return paramName in params ? String(params[paramName]) : match;
  });
}

/**
 * Localized date formatter.
 * @param {Date | string | number} date
 * @param {Intl.DateTimeFormatOptions} [options]
 * @param {string} [lang]
 * @returns {string}
 */
export function formatDate(date, options = {}, lang = null) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";

  const resolvedLang = typeof options === "string" ? options : lang;
  const resolvedOpts = typeof options === "object" && options !== null ? options : {};

  const currentLang = resolvedLang && SUPPORTED_LANGUAGES.has(resolvedLang) ? resolvedLang : getLanguage();
  const locale = currentLang === "en" ? "en-US" : "az-AZ";

  const defaultOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };

  return new Intl.DateTimeFormat(locale, { ...defaultOptions, ...resolvedOpts }).format(d);
}

/**
 * Localized time formatter.
 * @param {Date | string | number} date
 * @param {Intl.DateTimeFormatOptions | string} [options]
 * @param {string} [lang]
 * @returns {string}
 */
export function formatTime(date, options = {}, lang = null) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";

  const resolvedLang = typeof options === "string" ? options : lang;
  const resolvedOpts = typeof options === "object" && options !== null ? options : {};

  const currentLang = resolvedLang && SUPPORTED_LANGUAGES.has(resolvedLang) ? resolvedLang : getLanguage();
  const locale = currentLang === "en" ? "en-US" : "az-AZ";

  const defaultOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };

  return new Intl.DateTimeFormat(locale, { ...defaultOptions, ...resolvedOpts }).format(d);
}

/**
 * Relative time formatter with localized terms ("just now", "5m ago", etc.).
 * @param {Date | string | number} date
 * @param {string} [lang]
 * @returns {string}
 */
export function formatRelativeTime(date, lang = null) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";

  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 45) {
    return t("time.justNow", {}, lang);
  }
  if (diffMin < 60) {
    return t("time.minutesAgo", { count: diffMin }, lang);
  }
  if (diffHour < 24) {
    return t("time.hoursAgo", { count: diffHour }, lang);
  }
  if (diffDay === 1) {
    return t("time.yesterday", {}, lang);
  }
  if (diffDay < 7) {
    return t("time.daysAgo", { count: diffDay }, lang);
  }
  return formatDate(d, { year: "numeric", month: "short", day: "numeric" }, lang);
}

/**
 * Number formatter with active locale.
 * @param {number} num
 * @param {Intl.NumberFormatOptions | string} [options]
 * @param {string} [lang]
 * @returns {string}
 */
export function formatNumber(num, options = {}, lang = null) {
  const resolvedLang = typeof options === "string" ? options : lang;
  const resolvedOpts = typeof options === "object" && options !== null ? options : {};

  const currentLang = resolvedLang && SUPPORTED_LANGUAGES.has(resolvedLang) ? resolvedLang : getLanguage();
  const locale = currentLang === "en" ? "en-US" : "az-AZ";
  return new Intl.NumberFormat(locale, resolvedOpts).format(Number(num) || 0);
}

// Initialize html lang attribute on module load
try {
  const activeLang = getLanguage();
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.lang = activeLang;
  }
} catch {}
