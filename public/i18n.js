/**
 * Marketify AI — Centralized Localization & Internationalization (i18n)
 * Supports Azerbaijani ('az') and English ('en') with zero machine translation.
 */

const STORAGE_KEY = "marketify_language";
const DEFAULT_LANGUAGE = "az";
const SUPPORTED_LANGUAGES = new Set(["az"]);

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
      workspaceAria: "Workspace",
      shortcuts: "Qısayollar",
      terms: "İstifadə şərtləri",
      privacy: "Məxfilik siyasəti",
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
        masterToggleTitle: "Fərdiləşdirilmiş cavablar və strategiyalar",
        masterToggleIntro: "Aktiv olduqda Ask söhbətləri və Build rejimi aşağıdakı brend profili, üslub və yaddaş qeydləri əsasında cavab verir.",
        importCardTitle: "Yaddaş köçür",
        importCardIntro: "ChatGPT, Claude və ya Gemini-dakı yaddaşınızı və brend məlumatlarınızı Marketify-a birbaşa köçürün.",
        importBtn: "Yaddaşı köçür",
        profileTitle: "Biznes və brend profili",
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
        customTitle: "Xüsusi təlimatlar",
        customIntro: "Marketify-ın sizin üçün cavab hazırlayarkən riayət etməli olduğu xüsusi qaydalar.",
        customLabel: "Təlimat mətni",
        customPlaceholder: "Məsələn: Təkliflərdə həmişə büdcəyə qənaətcil rəqəmsal kanalları önə çək. Cavablarda addım-addım icra planı və ölçülə bilən KPI cədvəli təqdim et...",
        memoryTitle: "Memory Hub",
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
        scopesIntro: "Fərdiləşdirmənin hansı modullarda işləməsini tənzimləyin.",
        scopeAskTitle: "Ask",
        scopeAskDesc: "Cari sualınızla bağlı olduqda keçmiş söhbətlər və strategiyalardan faydalı məlumatlar avtomatik cəlb edilir.",
        scopeBuildTitle: "Build",
        scopeBuildDesc: "Yeni strategiya yaradarkən və dəqiqləşdirərkən yuxarıdakı brend profili və ton nəzərə alınır.",
        defaultModeTitle: "İlkin açılış rejimi",
        defaultModeIntro: "Marketify açıldıqda hansı rejimdə başlamasını seçin.",
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
        updatingPassword: "Yenilənir…",
        passwordUpdatedToast: "Şifrəniz uğurla yeniləndi.",
        logoutBtn: "Çıxış et",
      },
      legal: {
        title: "Hüquqi məlumatlar və məxfilik",
        intro: "İstifadə qaydaları, məxfilik prinsipləri və əlaqə vasitələri.",
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
  },

  en: {
    // ── Global & Brand ────────────────────────────────────────────────────────
    brand: {
      name: "Marketify AI",
      tagline: "Turns your business goals into structured, actionable strategies.",
      workspaceName: "Marketify Workspace",
      personalAccount: "Personal Account",
      guestAccount: "Guest Account",
      homeAriaLabel: "Marketify AI Homepage",
    },

    // ── Navigation & Rail ─────────────────────────────────────────────────────
    nav: {
      skipToMain: "Skip to main content",
      menu: "Menu",
      openMenu: "Open workspace menu",
      closeMenu: "Close menu",
      home: "Home",
      archive: "Archive",
      planner: "Planner",
      limits: "Usage",
      settings: "Settings",
      newStrategy: "New Strategy",
      newChat: "New Chat",
      recentWork: "Recent Work",
      recentWorkEmptyTitle: "Strategies will appear here.",
      recentWorkEmptySubtitle: "Saved work stays organized in this section.",
      recentChatsEmptyTitle: "Chats will appear here.",
      recentChatsEmptySubtitle: "Past discussions stay accessible in this section.",
      modeSwitchAria: "Work Mode",
      modeBuild: "Build",
      modeAsk: "Ask",
      switchToAsk: "Switch to Ask mode",
      switchToBuild: "Switch to Build mode",
      modeTooltipBuildToAsk: "Mode: Build (Switch to Ask)",
      modeTooltipAskToBuild: "Mode: Ask (Switch to Build)",
      quickNavAria: "Quick Navigation",
      workspaceAria: "Workspace",
      shortcuts: "Shortcuts",
      terms: "Terms of Service",
      privacy: "Privacy Policy",
      languageToggle: "Change language (AZ)",
      languageToggleAria: "Switch interface language to Azerbaijani",
      themeToggleDark: "Switch to Dark Mode",
      themeToggleLight: "Switch to Light Mode",
    },

    // ── Keyboard Shortcuts ───────────────────────────────────────────────────
    shortcuts: {
      title: "Keyboard Shortcuts",
      subtitle: "Fast controls for {platform}",
      closeAria: "Close keyboard shortcuts window",
      hint: "Shortcuts work even while typing in text fields. Press ⌘/Ctrl + / or ? to open this list.",
      or: "or",
      items: {
        newStrategyOrChat: "New strategy or chat",
        home: "Home",
        archive: "Archive",
        planner: "Planner",
        settings: "Settings",
        modeToggle: "Switch between Build and Ask modes",
        closeModal: "Close this window",
      },
    },

    // ── Build Intake (Home) ──────────────────────────────────────────────────
    intake: {
      kicker: "STRATEGY BUILDER",
      title: "Turn your business goals into strategy.",
      subtitle: "Provide your context. Marketify clarifies missing details and builds an execution-ready marketing roadmap.",
      placeholder: "For example: We are launching a new premium coffee shop in Baku. We need a 6-month go-to-market strategy and digital marketing roadmap...",
      submitButton: "Build Strategy",
      submitThinking: "Thinking…",
      submitAnalyzing: "Analyzing…",
      attachFile: "Attach File",
      attachFileTooltip: "PDF, Word, TXT (max 10MB)",
      removeFile: "Remove file",
      suggestionsTitle: "Starter Templates",
      fileTooLarge: "File size must not exceed 10MB.",
      fileInvalidType: "Only PDF, DOCX, TXT, and MD files are supported.",
      errorEmptyPrompt: "Please describe your business goal or project.",
    },

    // ── Clarification ────────────────────────────────────────────────────────
    clarification: {
      kicker: "CLARIFICATION",
      title: "A few questions for a more targeted strategy",
      subtitle: "Marketify analyzed your context. Answering these targeted questions will ensure a more accurate and actionable strategy.",
      questionCounter: "Question {current} of {total}",
      skipQuestion: "Skip this question",
      skipAll: "Skip remaining & build strategy",
      nextButton: "Next Question",
      finishButton: "Finish & Build Strategy",
      textPlaceholder: "Enter your answer here or provide additional notes...",
      customOptionPlaceholder: "Type your own answer...",
      optionOther: "Other option",
      generatingStrategy: "Generating strategy…",
    },

    // ── Loading Screen ───────────────────────────────────────────────────────
    loading: {
      title: "Generating your strategy",
      subtitle: "Analyzing business context, structuring strategic priorities and execution roadmap.",
      bgJobNote: "You can safely leave this page; the process will continue in the background and save to your Archive.",
      tips: [
        "Analyzing business context and market dynamics…",
        "Refining target audience and positioning…",
        "Optimizing marketing channels and budget allocation…",
        "Structuring step-by-step execution roadmap…",
        "Defining measurable KPIs and risk mitigation strategies…",
        "Finalizing strategic document…",
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
      linkCopied: "Link copied",
      duplicate: "Duplicate",
      duplicatedToast: "Strategy duplicate created.",
      exportMenu: "Export",
      exportPdf: "Download as PDF",
      exportDocx: "Download as Word (.docx)",
      exportXls: "Download as Excel (.xls)",
      exportCsv: "Export as CSV",
      exportMarkdown: "Copy as Markdown",
      markdownCopied: "Markdown copied to clipboard.",
      pdfGenerating: "Generating PDF…",
      sections: {
        priorities: "01. Strategic Priorities",
        positioning: "02. Positioning & Market Fit",
        actionPlan: "03. Execution Roadmap",
        kpis: "04. Success Metrics & KPIs",
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
        askAiAboutStrategy: "Ask AI about strategy",
        refineStrategy: "Refine Strategy",
      },
      refinement: {
        title: "Refine Strategy",
        subtitle: "Select a refinement objective or write custom instructions.",
        options: {
          shorten: "Make more concise",
          localize_azerbaijan: "Localize for Azerbaijan",
          think_deeper: "Deep analysis",
          make_practical: "Make more practical",
          budget_optimize: "Optimize budget",
          custom: "Custom refinement",
        },
        customPlaceholder: "What would you like to modify or add to this strategy?",
        submitButton: "Apply Refinement",
        applying: "Applying…",
      },
      askDrawer: {
        title: "Strategy AI Advisor",
        subtitle: "Ask questions about specific details, execution steps, or risks in this strategy.",
        placeholder: "Ask a question about this strategy...",
        send: "Send",
      },
    },

    // ── Ask Workspace (Chat) ─────────────────────────────────────────────────
    ask: {
      kicker: "AI ADVISOR",
      title: "Explore marketing and business questions.",
      subtitle: "Analyze competitors, test campaign concepts, and compare budgets and channels.",
      modelSelectorLabel: "Model:",
      modelAuto: "Auto",
      modelFlash: "Gemini 3.7 Flash",
      thinkingToggle: "Deep Think",
      searchToggle: "Web Search",
      newChat: "New Chat",
      clearChatConfirm: "Are you sure you want to start a new chat?",
      placeholder: "Ask a marketing question... (Press Enter to send)",
      send: "Send",
      attachFile: "Attach File",
      attachFileTooltip: "PDF, Word, TXT, Image",
      thinkingProcess: "Thinking Process",
      hideThinking: "Hide thinking",
      showThinking: "Show thinking",
      sources: "Sources ({count})",
      webSearchBadge: "Google Search",
      copyMessage: "Copy",
      messageCopied: "Copied",
      regenerate: "Regenerate",
      addToPlanner: "Add to Planner",
      reportMessage: "Report Issue",
      suggestedQuestions: "Suggested Prompts",
      exportChat: "Export Chat",
      deleteChatConfirm: "Are you sure you want to delete this chat history?",
    },

    // ── Archive ──────────────────────────────────────────────────────────────
    archive: {
      kicker: "WORK HISTORY",
      title: "Archive",
      subtitle: "All your saved strategies and past AI discussions.",
      searchPlaceholder: "Search strategies or chats...",
      filterAll: "All",
      filterStrategies: "Strategies",
      filterChats: "Chats",
      sortRecent: "Most Recent",
      sortAlpha: "Alphabetical",
      sortOldest: "Oldest",
      updatedAt: "Updated: {date}",
      versionsCount: "{count} versions",
      messagesCount: "{count} messages",
      emptyAllTitle: "No saved items found.",
      emptyAllSubtitle: "Start a new strategy or chat and it will be saved here automatically.",
      emptyFilterTitle: "No matching results.",
      emptyFilterSubtitle: "Try changing your search query or reset the filter.",
      deleteConfirmTitle: "Confirm Deletion",
      deleteConfirmBody: 'Delete "{title}"? This action cannot be undone.',
      cancel: "Cancel",
      delete: "Delete",
      deletedToast: "Successfully deleted.",
      open: "Open",
    },

    // ── Planner ──────────────────────────────────────────────────────────────
    planner: {
      kicker: "EXECUTION TRACKER",
      title: "Planner",
      subtitle: "Actionable tasks compiled from your strategies and discussions.",
      filterAll: "All ({count})",
      filterActive: "Active ({count})",
      filterCompleted: "Completed ({count})",
      inputPlaceholder: "Add a new task... (Press Enter to save)",
      groupSelectGeneral: "General",
      addButton: "Add Task",
      emptyTitle: "No tasks yet.",
      emptySubtitle: "Add execution tasks from your strategies or chats to track progress.",
      taskCompletedToast: "Task completed.",
      taskReopenedToast: "Task marked as active.",
      taskDeletedToast: "Task deleted.",
      deleteTaskAria: "Delete task",
    },

    // ── Limits & Usage ───────────────────────────────────────────────────────
    limits: {
      kicker: "USAGE & LIMITS",
      title: "Usage & Limits",
      subtitle: "Current usage metrics and account limits.",
      periodToday: "Today",
      periodMonth: "This Month",
      periodAllTime: "All Time",
      buildUsageTitle: "Build Mode",
      buildUsageSubtitle: "Strategy generations",
      askUsageTitle: "Ask Mode",
      askUsageSubtitle: "AI queries",
      contextUsageTitle: "Memory & Context",
      contextUsageSubtitle: "Saved strategies",
      resetNotice: "Daily limits reset every day at 00:00 UTC.",
      featureBreakdownTitle: "Included Features",
      features: {
        buildGen: "Full marketing strategy generation",
        askQueries: "Interactive AI Q&A and research",
        exportFormats: "Export to PDF, DOCX, Excel, and CSV",
        webSearch: "Web search and live verified sources",
        memoryHub: "Memory Hub and personalized context",
        unlimitedStorage: "Cloud storage for archives and history",
      },
    },

    // ── Settings ─────────────────────────────────────────────────────────────
    settings: {
      kicker: "WORKSPACE",
      title: "Settings",
      subtitle: "Manage your account, personalization, and workspace preferences.",
      guestTitle: "Save Your Progress",
      guestSubtitle: "You can use Marketify without an account. Creating a free account syncs your strategies across all devices.",
      guestPanelTitle: "Account is Optional",
      guestPanelIntro: "Your work is currently stored in this browser. Create a free account to access it from anywhere.",
      guestSignupBtn: "Create Account",
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
        intro: "Update your workspace profile and sign-in credentials.",
        fullName: "Full Name",
        username: "Username",
        email: "Email",
        saveBtn: "Save Changes",
        saving: "Saving…",
        successToast: "Account details updated.",
        dangerZoneTitle: "Danger Zone",
        deleteAccountBtn: "Delete Account",
        deleteAccountIntro: "Delete your account and all associated data with a 14-day security grace period.",
      },
      experience: {
        title: "Personalized Experience",
        intro: "Define your brand, industry, and preferred tone to tailor Marketify AI directly to your business.",
        masterToggleTitle: "Personalized responses and strategies",
        masterToggleIntro: "When enabled, Ask chats and Build mode use your brand profile, tone, and memory notes.",
        importCardTitle: "Import Memory",
        importCardIntro: "Import memory and brand details directly from ChatGPT, Claude, or Gemini into Marketify.",
        importBtn: "Import Memory",
        profileTitle: "Business & Brand Profile",
        profileIntro: "Set key company facts once so you don't have to repeat them in every prompt.",
        brandName: "Brand / Project Name",
        brandNamePlaceholder: "e.g. Marketify AI",
        industry: "Industry / Vertical",
        industryPlaceholder: "e.g. B2B SaaS, E-commerce, Skincare",
        primaryMarket: "Primary Market / Geography",
        primaryMarketPlaceholder: "e.g. Azerbaijan (Baku and regions), Global",
        targetAudience: "Target Audience",
        targetAudiencePlaceholder: "e.g. 20-35 tech professionals, founders",
        toneTitle: "AI Response Tone & Style",
        toneIntro: "Choose the communication style and voice for generated strategies and answers.",
        tones: {
          professional: {
            name: "Professional & Analytical",
            desc: "Structured business arguments, data-backed analysis, and formal terminology.",
          },
          creative: {
            name: "Creative & Bold",
            desc: "Unconventional marketing angles, viral hooks, and high-impact messaging.",
          },
          concise: {
            name: "Concise & Action-Oriented",
            desc: "No fluff, direct action steps, concise bullet points, and immediate execution.",
          },
          friendly: {
            name: "Friendly & Instructive",
            desc: "Approachable tone, clear explanations, and accessible marketing guidance.",
          },
          data_driven: {
            name: "Outcome & Conversion-Focused",
            desc: "Focused on conversions, ROAS, sales funnels, and revenue metrics.",
          },
        },
        customTitle: "Custom Instructions",
        customIntro: "Specific rules and instructions Marketify should follow when drafting responses for you.",
        customLabel: "Instruction Text",
        customPlaceholder: "e.g. Always prioritize cost-effective digital channels and provide actionable KPI tables with step-by-step milestones...",
        memoryTitle: "Memory Hub",
        memoryIntro: "Manage facts and context Marketify remembers about your business.",
        memoryBadge: "{count} items",
        memoryFilters: {
          all: "All",
          preference: "Preferences",
          constraint: "Constraints",
          business: "Business Facts",
        },
        memoryCategories: {
          business: "Business Fact",
          audience: "Audience",
          preference: "Preference",
          constraint: "Constraint",
          general: "Note",
        },
        memoryEmpty: "No memory items saved yet.",
        memoryEmptyCategory: "No memory items in this category.",
        newMemoryTitle: "New Memory Item",
        newMemoryHint: "Keep it concise and factual for best AI accuracy",
        newMemoryPlaceholder: "Add a fact... e.g. We exclusively sell to B2B enterprise clients",
        saveMemoryBtn: "Save Memory",
        addMemoryActionBtn: "+ Add Memory",
        importInlineBtn: "Import from Another AI",
        clearAllMemoriesBtn: "Clear All Memory",
        clearMemoriesConfirm: "Are you sure you want to delete all saved memory notes?",
        scopesTitle: "Application Scopes",
        scopesIntro: "Control which modules utilize your personalized context.",
        scopeAskTitle: "Ask",
        scopeAskDesc: "Automatically retrieves relevant context from past chats and strategies when answering questions.",
        scopeBuildTitle: "Build",
        scopeBuildDesc: "Applies your brand profile and tone when creating and refining strategies.",
        defaultModeTitle: "Default Start Mode",
        defaultModeIntro: "Choose which mode activates when you open Marketify.",
        modes: {
          build: {
            name: "Build",
            desc: "Start directly in the structured strategy builder mode.",
          },
          ask: {
            name: "Ask",
            desc: "Start directly in the interactive AI advisor and Q&A mode.",
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
        updatingPassword: "Updating…",
        passwordUpdatedToast: "Password updated successfully.",
        logoutBtn: "Log Out",
      },
      legal: {
        title: "Legal & Privacy",
        intro: "Terms of service, privacy practices, and compliance reporting.",
        viewTerms: "Read Terms of Service",
        viewPrivacy: "Read Privacy Policy",
        reportIssueTitle: "Report an Issue / Legal Notice",
        reportIssueIntro: "Report copyright concerns, sensitive content, or system inaccuracies.",
        issueType: "Issue Type",
        issueTypeSelect: "Select issue category",
        issueTypes: {
          copyright: "Copyright and intellectual property infringement",
          privacy: "Personal data and privacy violation",
          harmful: "Harmful, unethical, or misleading content",
          incorrect: "Critical factual inaccuracy or misinformation",
          other: "Other legal or technical issue",
        },
        issueDesc: "Detailed Description",
        issueDescPlaceholder: "Describe the issue and where you encountered it...",
        issueEmail: "Contact Email (optional)",
        submitReportBtn: "Submit Report",
        submittingReport: "Submitting…",
        reportSuccessToast: "Your report has been submitted. Thank you!",
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
      subtitle: "14-day security grace period",
      closeAria: "Close",
      callout: "Your account is not deleted immediately. A 14-day security grace period applies.",
      rule1Title: "Immediate Deactivation:",
      rule1Desc: "Your active session will end immediately and your account enters protected deactivation status.",
      rule2Title: "Automatic Recovery Within 14 Days:",
      rule2Desc: "If you change your mind within 14 days, simply sign back into your account to cancel deletion and restore your data.",
      rule3Title: "Permanent Erasure After 14 Days:",
      rule3Desc: "If you do not sign in within 14 days, all strategies, chats, and personal data will be permanently erased.",
      confirmInputLabel: 'Type "DELETE" or "SIL" to confirm:',
      confirmInputPlaceholder: "DELETE or SIL",
      confirmBtn: "Deactivate and Schedule Deletion",
      canceling: "Canceling…",
      cancelBtn: "Cancel",
    },

    // ── Common UI / Toasts / Errors ──────────────────────────────────────────
    common: {
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
        <div class="legal-doc-section">
          <h3>1. Giriş və Qəbul</h3>
          <p>Marketify AI platformasına xoş gəlmisiniz. Bu xidmətdən istifadə etməklə siz hazırkı İstifadə Şərtlərini tam şəkildə qəbul etmiş olursunuz.</p>
        </div>
        <div class="legal-doc-section">
          <h3>2. Xidmətin Təyinatı və Məsuliyyət</h3>
          <p>Marketify AI marketinq strategiyaları, bazar araşdırmaları və biznes planlaşdırması üçün süni intellekt əsaslı köməkçi vasitədir. Sistem tərəfindən yaradılan məzmun tövsiyə xarakteri daşıyır. İstifadəçi strateji qərarlar qəbul etməzdən əvvəl məlumatları müstəqil şəkildə yoxlamağa borcludur.</p>
        </div>
        <div class="legal-doc-section">
          <h3>3. Əqli Mülkiyyət və Məzmun Hüquqları</h3>
          <p>İstifadəçi tərəfindən daxil edilən biznes brifləri və kontekst məlumatları istifadəçinin mülkiyyətində qalır. Marketify platforması vasitəsilə generasiya edilən strategiya və sənədlərdən istifadə hüququ tam olaraq istifadəçiyə məxsusdur.</p>
        </div>
        <div class="legal-doc-section">
          <h3>4. Hesabın İdarə Edilməsi və Silinməsi</h3>
          <p>İstifadəçi istənilən vaxt hesabının silinməsini tələb edə bilər. Hesabın silinməsi təsdiq edildikdən sonra 14 günlük təhlükəsizlik və bərpa müddəti tətbiq olunur. Bu müddət ərzində daxil olunmadıqda bütün fərdi məlumatlar həmişəlik silinir.</p>
        </div>
      `,
    },
    privacy: {
      title: "Məxfilik Siyasəti",
      subtitle: "Fərdi məlumatların qorunması və emalı prinsipləri",
      html: `
        <div class="legal-doc-section">
          <h3>1. Toplanan Məlumatlar</h3>
          <p>Biz yalnız platformadan istifadə üçün zəruri olan məlumatları toplayırıq: ad, istifadəçi adı, e-poçt ünvanı və təqdim etdiyiniz biznes brifləri.</p>
        </div>
        <div class="legal-doc-section">
          <h3>2. Məlumatların Qorunması</h3>
          <p>Şifrələr müasir Argon2id alqoritmi ilə heşlənir. Məlumatlar şifrələnmiş kanallarla ötürülür və icazəsiz müdaxilələrdən etibarlı şəkildə qorunur.</p>
        </div>
        <div class="legal-doc-section">
          <h3>3. Üçüncü Tərəflərə Ötürülmə</h3>
          <p>Fərdi məlumatlarınız heç bir halda üçüncü tərəflərə satılmır və ya marketinq məqsədilə ötürülmür.</p>
        </div>
        <div class="legal-doc-section">
          <h3>4. İstifadəçi Hüquqları</h3>
          <p>Siz istənilən vaxt məlumatlarınıza baxmaq, redaktə etmək və ya hesabınızla birlikdə tam silmək hüququna maliksiniz.</p>
        </div>
      `,
    },
  },
  en: {
    terms: {
      title: "Terms of Service",
      subtitle: "Terms and conditions governing the use of Marketify AI",
      html: `
        <div class="legal-doc-section">
          <h3>1. Introduction & Acceptance</h3>
          <p>Welcome to Marketify AI. By accessing or using our platform, you agree to be bound by these Terms of Service.</p>
        </div>
        <div class="legal-doc-section">
          <h3>2. Purpose & Disclaimer</h3>
          <p>Marketify AI is an artificial intelligence-powered workspace designed for marketing strategy, research, and planning. Content generated by the system serves an advisory purpose. Users are responsible for independently verifying data and making commercial decisions.</p>
        </div>
        <div class="legal-doc-section">
          <h3>3. Intellectual Property & Ownership</h3>
          <p>You retain full ownership of the briefs, brand profiles, and context data you submit. You also hold the full right to use, publish, and commercially execute strategies generated through Marketify.</p>
        </div>
        <div class="legal-doc-section">
          <h3>4. Account Management & Deletion</h3>
          <p>You may request account deletion at any time. A 14-day security grace period applies upon deactivation. If you do not sign in during this period, all personal data, strategies, and chats are permanently deleted.</p>
        </div>
      `,
    },
    privacy: {
      title: "Privacy Policy",
      subtitle: "Principles of personal data protection and processing",
      html: `
        <div class="legal-doc-section">
          <h3>1. Data We Collect</h3>
          <p>We collect only the information necessary to provide our service: your name, username, email address, and the business briefs you submit.</p>
        </div>
        <div class="legal-doc-section">
          <h3>2. Data Security</h3>
          <p>Passwords are securely hashed using modern Argon2id. All communications occur over encrypted TLS connections to safeguard your data from unauthorized access.</p>
        </div>
        <div class="legal-doc-section">
          <h3>3. Third-Party Sharing</h3>
          <p>We never sell or distribute your personal data or business strategies to third parties for advertising or commercial purposes.</p>
        </div>
        <div class="legal-doc-section">
          <h3>4. Your Rights</h3>
          <p>You have the right to access, export, modify, or permanently delete your account and associated records at any time.</p>
        </div>
      `,
    },
  },
};

/**
 * Get active language code ('az').
 */
export function getLanguage() {
  return DEFAULT_LANGUAGE;
}

/**
 * Set active language code and dispatch change event.
 * @param {'az'} [lang]
 * @param {boolean} [persist=true]
 */
export function setLanguage(lang, persist = true) {
  const target = DEFAULT_LANGUAGE;
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, target);
    } catch {}
  }
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.lang = target;
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

  const currentLang = lang && SUPPORTED_LANGUAGES.has(lang) ? lang : getLanguage();
  const locale = currentLang === "en" ? "en-US" : "az-AZ";

  const defaultOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };

  return new Intl.DateTimeFormat(locale, { ...defaultOptions, ...options }).format(d);
}

/**
 * Localized time formatter.
 * @param {Date | string | number} date
 * @param {Intl.DateTimeFormatOptions} [options]
 * @param {string} [lang]
 * @returns {string}
 */
export function formatTime(date, options = {}, lang = null) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";

  const currentLang = lang && SUPPORTED_LANGUAGES.has(lang) ? lang : getLanguage();
  const locale = currentLang === "en" ? "en-US" : "az-AZ";

  const defaultOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };

  return new Intl.DateTimeFormat(locale, { ...defaultOptions, ...options }).format(d);
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
 * @param {Intl.NumberFormatOptions} [options]
 * @param {string} [lang]
 * @returns {string}
 */
export function formatNumber(num, options = {}, lang = null) {
  const currentLang = lang && SUPPORTED_LANGUAGES.has(lang) ? lang : getLanguage();
  const locale = currentLang === "en" ? "en-US" : "az-AZ";
  return new Intl.NumberFormat(locale, options).format(Number(num) || 0);
}

// Initialize html lang attribute on module load
try {
  const activeLang = getLanguage();
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.lang = activeLang;
  }
} catch {}
