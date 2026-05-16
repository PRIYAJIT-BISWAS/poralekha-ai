import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Calculator, CheckCircle2, Check, GraduationCap, ImageUp, Loader2, LogIn, Send, Sparkles, Star, X } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import rehypeKatex from "rehype-katex";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";

import NavbarLanguageSwitcher from "@/components/NavbarLanguageSwitcher";
import MathRenderer from "@/components/MathRenderer";
import { useLanguage } from "@/context/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import type { InterfaceLanguage, TranslationKey } from "@/translations";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Poralekha AI Study Companion" },
      {
        name: "description",
        content: "Premium Bangla AI study companion for SSC and HSC students in Bangladesh.",
      },
      { property: "og:title", content: "Poralekha AI Study Companion" },
      {
        property: "og:description",
        content: "Ask Bangla questions, get step-by-step SSC and HSC study help.",
      },
    ],
  }),
  component: Index,
});

type StudyMode = "ব্যাখ্যা" | "সমাধান" | "কুইজ";
type StudyTab = "question" | "step_marking";
type ProductScreen = "login" | "product";
type LanguagePreference = "bangla" | "english";
type ConfidenceLevel = "High" | "Medium" | "Low";
type StepStatus = "correct" | "partial" | "wrong";
type StepMarkingResult = {
  steps: Array<{ step: string; status: StepStatus; feedback: string }>;
  score: number;
  overallFeedback: string;
  correctSolution: string;
};
type StudyHistoryItem = {
  id: string;
  question: string;
  answer: string;
  language_used: LanguagePreference;
  entry_type?: StudyTab;
  score?: number | null;
  created_at: string;
};
type ReportType = "ভুল তথ্য" | "অসম্পূর্ণ উত্তর" | "বিষয়ের বাইরে" | "অন্য সমস্যা";
type StepImageTarget = "question" | "solution";

const subjectOptions: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: "গণিত", labelKey: "subject_math" },
  { value: "পদার্থবিজ্ঞান", labelKey: "subject_physics" },
  { value: "রসায়ন", labelKey: "subject_chemistry" },
  { value: "জীববিজ্ঞান", labelKey: "subject_biology" },
  { value: "ইংরেজি", labelKey: "subject_english" },
  { value: "বাংলা", labelKey: "subject_bangla" },
];
const stepSubjectOptions = subjectOptions.slice(0, 3);
const subjects = subjectOptions.map((item) => item.value);
const stepSubjects = stepSubjectOptions.map((item) => item.value);
const levels = ["SSC", "HSC", "Class 8", "Class 9", "Class 10"];
const features: Array<{ icon: typeof Calculator; titleKey: TranslationKey; textKey: TranslationKey }> = [
  { icon: Calculator, titleKey: "feature_steps_title", textKey: "feature_steps_text" },
  { icon: BookOpen, titleKey: "feature_notes_title", textKey: "feature_notes_text" },
  { icon: CheckCircle2, titleKey: "feature_practice_title", textKey: "feature_practice_text" },
];
const pricingPlans: Array<{ nameKey: TranslationKey; priceKey: TranslationKey; textKey: TranslationKey; recommended: boolean }> = [
  { nameKey: "pricing_starter_name", priceKey: "pricing_starter_price", textKey: "pricing_starter_text", recommended: false },
  { nameKey: "pricing_pro_name", priceKey: "pricing_pro_price", textKey: "pricing_pro_text", recommended: true },
  { nameKey: "pricing_batch_name", priceKey: "pricing_batch_price", textKey: "pricing_batch_text", recommended: false },
];
const languageOptions: Array<{ value: LanguagePreference; icon: string; titleKey: TranslationKey; pillKey: TranslationKey; descriptionKey: TranslationKey }> = [
  { value: "bangla", icon: "🇧🇩", titleKey: "answer_bangla_title", pillKey: "answer_bangla_pill", descriptionKey: "answer_bangla_desc" },
  { value: "english", icon: "🇬🇧", titleKey: "answer_english_title", pillKey: "answer_english_pill", descriptionKey: "answer_english_desc" },
];
const interfaceLanguageOptions: Array<{ value: InterfaceLanguage; pill: string; titleKey: TranslationKey; descriptionKey: TranslationKey }> = [
  { value: "bangla", pill: "🇧🇩 বাংলা", titleKey: "interface_bangla_title", descriptionKey: "interface_bangla_desc" },
  { value: "english", pill: "🇬🇧 EN", titleKey: "interface_english_title", descriptionKey: "interface_english_desc" },
];
const reportOptions: Array<{ value: ReportType; labelKey: TranslationKey }> = [
  { value: "ভুল তথ্য", labelKey: "report_wrong_info" },
  { value: "অসম্পূর্ণ উত্তর", labelKey: "report_incomplete" },
  { value: "বিষয়ের বাইরে", labelKey: "report_off_topic" },
  { value: "অন্য সমস্যা", labelKey: "report_other" },
];
const acceptedStepImageTypes = ["image/jpeg", "image/png", "image/webp"];

const validateQuestion = (value: string, t: (key: TranslationKey) => string) => {
  const trimmed = value.trim();
  if (!trimmed.length) return t("error_question_required");
  if (trimmed.length < 5) return t("error_too_short");
  if (trimmed.length > 1000) return t("error_too_long");
  return null;
};

const validateStepInputs = (question: string, solution: string, questionImage: string, solutionImage: string, t: (key: TranslationKey) => string) => {
  const hasQuestion = question.trim().length > 0 || questionImage.length > 0;
  const hasSolution = solution.trim().length > 0 || solutionImage.length > 0;

  if (!hasQuestion) return t("error_empty_question");
  if (!hasSolution) return t("error_empty_solution");
  return null;
};

function Index() {
  const { language: interfaceLanguage, t, changeLanguage } = useLanguage();
  const [productScreen, setProductScreen] = useState<ProductScreen>("login");
  const [studyTab, setStudyTab] = useState<StudyTab>("question");
  const [question, setQuestion] = useState("");
  const [stepQuestion, setStepQuestion] = useState("");
  const [studentSolution, setStudentSolution] = useState("");
  const [stepQuestionImage, setStepQuestionImage] = useState("");
  const [stepSolutionImage, setStepSolutionImage] = useState("");
  const [stepQuestionImageName, setStepQuestionImageName] = useState("");
  const [stepSolutionImageName, setStepSolutionImageName] = useState("");
  const [stepResult, setStepResult] = useState<StepMarkingResult | null>(null);
  const [stepError, setStepError] = useState("");
  const [stepValidationError, setStepValidationError] = useState("");
  const [isStepLoading, setIsStepLoading] = useState(false);
  const [subject, setSubject] = useState(subjects[0]);
  const [stepSubject, setStepSubject] = useState(stepSubjects[0]);
  const [level, setLevel] = useState(levels[0]);
  const [mode, setMode] = useState<StudyMode>("ব্যাখ্যা");
  const [answer, setAnswer] = useState("");
  const [confidence, setConfidence] = useState<ConfidenceLevel | "">("");
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [reportStatus, setReportStatus] = useState("");
  const [isReporting, setIsReporting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [imageName, setImageName] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState<LanguagePreference>("bangla");
  const [savedLanguage, setSavedLanguage] = useState<LanguagePreference>("bangla");
  const [isSavingLanguage, setIsSavingLanguage] = useState(false);
  const [languageStatus, setLanguageStatus] = useState("");
  const [history, setHistory] = useState<StudyHistoryItem[]>([]);

  useEffect(() => {
    void loadCurrentProfile();
  }, []);

  async function loadCurrentProfile() {
    const localLang = localStorage.getItem("poralekha_answer_language") as LanguagePreference | null;
    if (localLang === "bangla" || localLang === "english") {
      setPreferredLanguage(localLang);
      setSavedLanguage(localLang);
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    setCurrentUserId(userId);
    const { data } = await (supabase as any)
      .from("profiles")
      .select("preferred_language, interface_language")
      .eq("user_id", userId)
      .maybeSingle();
    const loadedLanguage = (data?.preferred_language as LanguagePreference | undefined) ?? localLang ?? "bangla";
    setPreferredLanguage(loadedLanguage);
    setSavedLanguage(loadedLanguage);
    if (data?.interface_language) void changeLanguage(data.interface_language as InterfaceLanguage);
    await loadStudyHistory(userId);
  }

  async function loadStudyHistory(userId = currentUserId) {
    if (!userId) return;
    const { data } = await (supabase as any)
      .from("study_history")
      .select("id, question, answer, language_used, entry_type, score, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(4);
    setHistory((data as StudyHistoryItem[] | null) ?? []);
  }

  async function saveLanguagePreference(language: LanguagePreference, showStatus = true) {
    setPreferredLanguage(language);
    setSavedLanguage(language);
    setLanguageStatus("");
    localStorage.setItem("poralekha_answer_language", language);

    if (!currentUserId) {
      if (showStatus) setLanguageStatus(t("answer_language_saved_session"));
      return;
    }

    setIsSavingLanguage(true);
    const { error: saveError } = await (supabase as any)
      .from("profiles")
      .upsert({ user_id: currentUserId, preferred_language: language }, { onConflict: "user_id" });
    setIsSavingLanguage(false);

    if (saveError) {
      setLanguageStatus(t("answer_language_save_failed"));
      return;
    }

    if (showStatus) setLanguageStatus(t("answer_language_saved"));
  }

  async function handleLanguageTest(lang: LanguagePreference) {
    const testQuestion = lang === "english" ? "What is 2+2? Answer in one sentence." : "২+২ কত? এক বাক্যে উত্তর দাও।";
    setLanguageStatus(lang === "english" ? "Sending test..." : "পরীক্ষা করা হচ্ছে...");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("study-companion", {
        body: { question: testQuestion, subject: "গণিত", level: "SSC", mode: "ব্যাখ্যা", preferredLanguage: lang },
      });
      if (fnError || !data?.answer) {
        setLanguageStatus(lang === "english" ? "Test failed — check connection." : "পরীক্ষা ব্যর্থ হয়েছে।");
      } else {
        const preview = String(data.answer).slice(0, 80).trim();
        setLanguageStatus(`✅ ${preview}…`);
      }
    } catch (_) {
      setLanguageStatus(lang === "english" ? "Test failed." : "পরীক্ষা ব্যর্থ হয়েছে।");
    }
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError("");

    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t("error_image_type"));
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError(t("error_image_size"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(String(reader.result));
      setImageName(file.name);
    };
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setImageDataUrl("");
    setImageName("");
  }

  function handleStepImageChange(target: StepImageTarget, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setStepValidationError("");
    event.target.value = "";

    if (!file) return;
    if (!acceptedStepImageTypes.includes(file.type)) {
      setStepValidationError(t("error_step_image_type"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setStepValidationError(t("error_step_image_size"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (target === "question") {
        setStepQuestionImage(String(reader.result));
        setStepQuestionImageName(file.name);
      } else {
        setStepSolutionImage(String(reader.result));
        setStepSolutionImageName(file.name);
      }
    };
    reader.readAsDataURL(file);
  }

  function clearStepImage(target: StepImageTarget) {
    if (target === "question") {
      setStepQuestionImage("");
      setStepQuestionImageName("");
    } else {
      setStepSolutionImage("");
      setStepSolutionImageName("");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setAnswer("");
    setConfidence("");
    setReportStatus("");

    const questionError = validateQuestion(question, t);
    setValidationError(questionError ?? "");
    if (questionError) {
      return;
    }

    setIsLoading(true);

    const { data, error: functionError } = await supabase.functions.invoke("study-companion", {
      body: { question, subject, level, mode, imageDataUrl, preferredLanguage },
    });

    if (functionError) {
      setError(t("error_ai_start"));
    } else if (data?.error) {
      setError(data.error);
    } else {
      const aiAnswer = data?.answer ?? t("error_no_answer");
      setAnswer(aiAnswer);
      setConfidence((data?.confidence as ConfidenceLevel | undefined) ?? "Medium");
      if (currentUserId) {
        const { data: savedHistory } = await (supabase as any)
          .from("study_history")
          .insert({ user_id: currentUserId, question: question.trim() || "Screenshot question", answer: aiAnswer, subject, level, mode, language_used: preferredLanguage, entry_type: "question" })
          .select("id, question, answer, language_used, entry_type, score, created_at")
          .single();
        if (savedHistory) setHistory((items) => [savedHistory as StudyHistoryItem, ...items].slice(0, 4));
      }
    }

    setIsLoading(false);
  }

  async function handleReport(reportType: ReportType) {
    if (!answer || isReporting) return;
    setIsReporting(true);
    setReportStatus("");
    const { error: reportError } = await (supabase as any)
      .from("error_reports")
      .insert({ user_id: currentUserId || null, question: question.trim(), ai_answer: answer, report_type: reportType });
    setIsReporting(false);
    setReportStatus(reportError ? t("error_report_failed") : t("error_report_sent"));
  }

  async function handleStepSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStepError("");
    setStepResult(null);

    const validationMessage = validateStepInputs(stepQuestion, studentSolution, stepQuestionImage, stepSolutionImage, t);
    setStepValidationError(validationMessage ?? "");
    if (validationMessage) return;

    setIsStepLoading(true);
    const { data, error: functionError } = await supabase.functions.invoke("study-companion", {
      body: { requestType: "step_marking", question: stepQuestion, studentSolution, questionImageDataUrl: stepQuestionImage, solutionImageDataUrl: stepSolutionImage, subject: stepSubject, level, preferredLanguage },
    });

    if (functionError) {
      setStepError(t("error_step_failed"));
    } else if (data?.error) {
      setStepError(data.error);
    } else {
      const marking = data?.marking as StepMarkingResult;
      setStepResult(marking);
      if (currentUserId && marking) {
        const savedAnswer = `নম্বর: ${marking.score}/10\n\n${marking.overallFeedback}`;
        const { data: savedHistory } = await (supabase as any)
          .from("study_history")
          .insert({ user_id: currentUserId, question: stepQuestion.trim() || "Handwritten question image", answer: savedAnswer, subject: stepSubject, level, mode: "যাচাই", language_used: preferredLanguage, entry_type: "step_marking", score: marking.score })
          .select("id, question, answer, language_used, entry_type, score, created_at")
          .single();
        if (savedHistory) setHistory((items) => [savedHistory as StudyHistoryItem, ...items].slice(0, 4));
      }
    }

    setIsStepLoading(false);
  }

  return (
    <main className="min-h-screen bg-background font-sans text-foreground">
      <header className="bg-secondary text-secondary-foreground">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8" aria-label="Main navigation">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-secondary-foreground/20 text-primary">
              <GraduationCap className="h-6 w-6" aria-hidden="true" />
            </div>
            <span className="text-xl font-extrabold tracking-normal">Poralekha AI</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <NavbarLanguageSwitcher />
            <button type="button" onClick={() => setProductScreen("login")} className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-foreground transition hover:opacity-90">
              {t("nav_start")}
            </button>
          </div>
        </nav>
      </header>

      <section className="bg-background px-5 py-20 text-center sm:px-8 lg:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-secondary px-4 py-2 text-sm font-bold text-secondary">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            {t("hero_badge")}
          </p>
          <h1 className="text-5xl font-extrabold leading-tight tracking-normal text-secondary sm:text-[48px]">
            {t("hero_title")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            {t("hero_subtitle")}
          </p>
          <button type="button" onClick={() => setProductScreen("login")} className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-8 text-base font-extrabold text-primary-foreground transition hover:opacity-90">
            {t("hero_cta")}
          </button>
        </div>
      </section>

      <section className="bg-background px-5 pb-20 sm:px-8">
        <div className="mx-auto max-w-5xl">
          {productScreen === "product" ? (
            <div className="grid gap-6">
              <InterfaceLanguagePanel selected={interfaceLanguage} onSelect={changeLanguage} />
              <LanguagePreferencePanel selected={preferredLanguage} status={languageStatus} onSelect={(lang) => saveLanguagePreference(lang)} onTest={handleLanguageTest} />
              <StudyTabSwitch activeTab={studyTab} onChange={setStudyTab} />
              <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
                {studyTab === "question" ? (
                  <StudyForm
                    level={level}
                    subject={subject}
                    mode={mode}
                    question={question}
                    imageDataUrl={imageDataUrl}
                    imageName={imageName}
                    isLoading={isLoading}
                    validationError={validationError}
                    onLevelChange={setLevel}
                    onSubjectChange={setSubject}
                    onModeChange={setMode}
                    onQuestionChange={setQuestion}
                    onImageChange={handleImageChange}
                    onClearImage={clearImage}
                    onSubmit={handleSubmit}
                  />
                ) : (
                  <StepMarkingForm level={level} subject={stepSubject} question={stepQuestion} studentSolution={studentSolution} questionImage={stepQuestionImage} solutionImage={stepSolutionImage} questionImageName={stepQuestionImageName} solutionImageName={stepSolutionImageName} isLoading={isStepLoading} validationError={stepValidationError} onLevelChange={setLevel} onSubjectChange={setStepSubject} onQuestionChange={setStepQuestion} onSolutionChange={setStudentSolution} onQuestionImageChange={(event: ChangeEvent<HTMLInputElement>) => handleStepImageChange("question", event)} onSolutionImageChange={(event: ChangeEvent<HTMLInputElement>) => handleStepImageChange("solution", event)} onClearQuestionImage={() => clearStepImage("question")} onClearSolutionImage={() => clearStepImage("solution")} onSubmit={handleStepSubmit} />
                )}
                <StudyBoard error={studyTab === "question" ? error : stepError} answer={answer} question={studyTab === "question" ? question : stepQuestion} imageDataUrl={studyTab === "question" ? imageDataUrl : ""} confidence={confidence} reportStatus={reportStatus} isReporting={isReporting} selectedLanguage={preferredLanguage} history={history} stepResult={studyTab === "step_marking" ? stepResult : null} activeTab={studyTab} onLanguageChange={(language) => saveLanguagePreference(language, false)} onReport={handleReport} />
              </div>
            </div>
          ) : (
            <AccessPanel onAccessApproved={() => setProductScreen("product")} />
          )}
        </div>
      </section>

      <section className="bg-background px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[32px] font-extrabold leading-tight text-secondary">{t("feature_section_title")}</h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">{t("feature_section_text")}</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <Feature key={feature.titleKey} icon={<feature.icon className="h-6 w-6" />} title={t(feature.titleKey)} text={t(feature.textKey)} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[32px] font-extrabold leading-tight text-secondary">{t("pricing_title")}</h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">{t("pricing_text")}</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {pricingPlans.map((plan) => (
              <PricingCard key={plan.nameKey} name={t(plan.nameKey)} price={t(plan.priceKey)} text={t(plan.textKey)} recommended={plan.recommended} />
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-secondary px-5 py-10 text-secondary-foreground sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-lg font-extrabold">Poralekha AI</p>
          <div className="flex gap-5 text-sm font-semibold">
            <a className="transition hover:text-primary" href="/">{t("footer_features")}</a>
            <a className="transition hover:text-primary" href="/">{t("footer_pricing")}</a>
            <a className="transition hover:text-primary" href="/">{t("footer_support")}</a>
          </div>
        </div>
      </footer>
    </main>
  );
}


type StudyFormProps = {
  level: string;
  subject: string;
  mode: StudyMode;
  question: string;
  imageDataUrl: string;
  imageName: string;
  isLoading: boolean;
  validationError: string;
  onLevelChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onModeChange: (value: StudyMode) => void;
  onQuestionChange: (value: string) => void;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClearImage: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function StudyTabSwitch({ activeTab, onChange }: { activeTab: StudyTab; onChange: (tab: StudyTab) => void }) {
  const { t } = useLanguage();

  return (
    <div className="inline-flex w-full rounded-xl border border-secondary bg-card p-2 [box-shadow:var(--shadow-card)] sm:w-fit">
      <button type="button" onClick={() => onChange("question")} className={activeTab === "question" ? "flex-1 rounded-lg bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground sm:flex-none" : "flex-1 rounded-lg px-5 py-3 text-sm font-extrabold text-secondary transition hover:bg-background sm:flex-none"}>
        {t("study_question_tab")}
      </button>
      <button type="button" onClick={() => onChange("step_marking")} className={activeTab === "step_marking" ? "flex-1 rounded-lg bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground sm:flex-none" : "flex-1 rounded-lg px-5 py-3 text-sm font-extrabold text-secondary transition hover:bg-background sm:flex-none"}>
        {t("study_step_tab")}
      </button>
    </div>
  );
}

function StudyForm({ level, subject, mode, question, imageDataUrl, imageName, isLoading, validationError, onLevelChange, onSubjectChange, onModeChange, onQuestionChange, onImageChange, onClearImage, onSubmit }: StudyFormProps) {
  const { t, language } = useLanguage();
  const [loadingMsg, setLoadingMsg] = useState("");

  const loadingMessages = {
    bangla: ["প্রশ্ন পড়ছি...", "চিন্তা করছি...", "উত্তর সাজাচ্ছি...", "প্রায় হয়ে গেছে..."],
    english: ["Reading your question...", "Thinking carefully...", "Writing the answer...", "Almost done..."],
  };

  useEffect(() => {
    if (!isLoading) { setLoadingMsg(""); return; }
    const msgs = language === "english" ? loadingMessages.english : loadingMessages.bangla;
    let index = 0;
    setLoadingMsg(msgs[0]);
    const interval = setInterval(() => {
      index = (index + 1) % msgs.length;
      setLoadingMsg(msgs[index]);
    }, 1500);
    return () => clearInterval(interval);
  }, [isLoading, language]);

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-secondary bg-card p-6 [box-shadow:var(--shadow-card)]">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-2 text-sm font-bold text-secondary">
          {t("study_level_label")}
          <select value={level} onChange={(event) => onLevelChange(event.target.value)} className="h-12 rounded-xl border border-secondary bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
            {levels.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-secondary">
          {t("study_subject_label")}
          <select value={subject} onChange={(event) => onSubjectChange(event.target.value)} className="h-12 rounded-xl border border-secondary bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
            {subjectOptions.map((item) => <option key={item.value} value={item.value}>{t(item.labelKey)}</option>)}
          </select>
        </label>
        <div className="grid gap-2">
          <span className="text-sm font-bold text-secondary">{t("study_mode_label")}</span>
          <div className="flex gap-2">
            {(["ব্যাখ্যা", "সমাধান", "কুইজ"] as StudyMode[]).map((m) => (
              <button key={m} type="button" onClick={() => onModeChange(m)} className={mode === m ? "h-12 flex-1 rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground transition" : "h-12 flex-1 rounded-xl border border-secondary px-4 text-sm font-extrabold text-secondary transition hover:opacity-80"}>
                {m === "ব্যাখ্যা" ? t("mode_explain") : m === "সমাধান" ? t("mode_solution") : t("mode_quiz")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="mt-5 grid gap-2 text-sm font-bold text-secondary">
        {t("study_instruction_label")}
        <textarea value={question} onChange={(event) => onQuestionChange(event.target.value)} rows={6} className="resize-none rounded-xl border border-secondary bg-background p-4 text-base leading-7 text-foreground outline-none focus:ring-2 focus:ring-ring" placeholder={t("study_question_placeholder")} />
      </label>
      {validationError ? <p className="mt-2 text-sm font-bold text-destructive">{validationError}</p> : null}

      <div className="mt-5 grid gap-3 rounded-xl border border-dashed border-secondary bg-background p-4">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-extrabold text-secondary-foreground transition hover:opacity-90">
          <ImageUp className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("study_image_upload")}
          <input type="file" accept="image/*" onChange={onImageChange} className="sr-only" />
        </label>
        {imageDataUrl ? (
          <div className="flex items-center gap-3 rounded-xl border border-secondary bg-card p-3">
            <img src={imageDataUrl} alt="Uploaded problem screenshot" className="h-16 w-16 rounded-xl border border-secondary object-cover" />
            <p className="min-w-0 flex-1 truncate text-sm font-bold text-secondary">{imageName}</p>
            <button type="button" onClick={onClearImage} className="flex h-10 w-10 items-center justify-center rounded-xl border border-secondary text-muted-foreground transition hover:text-primary" aria-label={t("remove_screenshot")}>
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">{t("study_image_help")}</p>
        )}
      </div>

      <button type="submit" disabled={isLoading} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-center text-base font-extrabold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70">
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        {isLoading ? <span>{loadingMsg}</span> : (language === "english" ? "Ask AI Tutor" : t("study_submit_button"))}
      </button>
    </form>
  );
}

type StepMarkingFormProps = {
  level: string;
  subject: string;
  question: string;
  studentSolution: string;
  questionImage: string;
  solutionImage: string;
  questionImageName: string;
  solutionImageName: string;
  isLoading: boolean;
  validationError: string;
  onLevelChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onQuestionChange: (value: string) => void;
  onSolutionChange: (value: string) => void;
  onQuestionImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSolutionImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClearQuestionImage: () => void;
  onClearSolutionImage: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function StepMarkingForm({ level, subject, question, studentSolution, questionImage, solutionImage, questionImageName, solutionImageName, isLoading, validationError, onLevelChange, onSubjectChange, onQuestionChange, onSolutionChange, onQuestionImageChange, onSolutionImageChange, onClearQuestionImage, onClearSolutionImage, onSubmit }: StepMarkingFormProps) {
  const { t } = useLanguage();
  const hasImage = Boolean(questionImage || solutionImage);

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-secondary bg-card p-6 [box-shadow:var(--shadow-card)]">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-secondary">
          {t("study_level_label")}
          <select value={level} onChange={(event) => onLevelChange(event.target.value)} className="h-12 rounded-xl border border-secondary bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
            {levels.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-secondary">
          {t("study_subject_label")}
          <select value={subject} onChange={(event) => onSubjectChange(event.target.value)} className="h-12 rounded-xl border border-secondary bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
            {stepSubjectOptions.map((item) => <option key={item.value} value={item.value}>{t(item.labelKey)}</option>)}
          </select>
        </label>
      </div>
      <label className="mt-5 grid gap-2 text-sm font-bold text-secondary">
        {t("step_question_label")}
        <textarea value={question} onChange={(event) => onQuestionChange(event.target.value)} rows={5} className="resize-none rounded-xl border border-secondary bg-background p-4 text-base leading-7 text-foreground outline-none focus:ring-2 focus:ring-ring" placeholder={t("step_question_placeholder")} />
      </label>
      <ImageUploadField label={t("step_image_question")} imageDataUrl={questionImage} imageName={questionImageName} alt={t("step_image_question")} onImageChange={onQuestionImageChange} onClear={onClearQuestionImage} />
      <label className="mt-5 grid gap-2 text-sm font-bold text-secondary">
        {t("step_solution_label")}
        <textarea value={studentSolution} onChange={(event) => onSolutionChange(event.target.value)} rows={9} className="resize-none rounded-xl border border-secondary bg-background p-4 text-base leading-7 text-foreground outline-none focus:ring-2 focus:ring-ring" placeholder={t("step_solution_placeholder")} />
      </label>
      <ImageUploadField label={t("step_image_solution")} imageDataUrl={solutionImage} imageName={solutionImageName} alt={t("step_image_solution")} onImageChange={onSolutionImageChange} onClear={onClearSolutionImage} />
      {validationError ? <p className="mt-2 text-sm font-bold text-destructive">{validationError}</p> : null}
      <button type="submit" disabled={isLoading} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-extrabold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70">
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
        {isLoading ? (hasImage ? t("step_loading") : t("step_checking")) : t("step_verify_button")}
      </button>
    </form>
  );
}

function ImageUploadField({ label, imageDataUrl, imageName, alt, onImageChange, onClear }: { label: string; imageDataUrl: string; imageName: string; alt: string; onImageChange: (event: ChangeEvent<HTMLInputElement>) => void; onClear: () => void }) {
  const { t } = useLanguage();

  return (
    <div className="mt-3 grid gap-3">
      <label className="flex w-full cursor-pointer items-center justify-center rounded-lg border border-dashed border-muted-foreground/40 bg-muted px-4 py-3 text-sm font-extrabold text-secondary transition hover:border-primary sm:w-fit sm:min-w-64">
        {label}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onImageChange} className="sr-only" />
      </label>
      {imageDataUrl ? (
        <div className="relative w-fit max-w-full">
          <img src={imageDataUrl} alt={alt} className="h-[100px] max-w-full rounded-lg border border-secondary/20 object-cover" />
          <button type="button" onClick={onClear} className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-sm font-extrabold text-destructive-foreground shadow-sm" aria-label={`${t("remove_image")} ${imageName}`}>
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}

function InterfaceLanguagePanel({ selected, onSelect }: { selected: InterfaceLanguage; onSelect: (language: InterfaceLanguage) => void }) {
  const { t } = useLanguage();

  return (
    <section className="rounded-xl border border-secondary bg-card p-6 [box-shadow:var(--shadow-card)]">
      <div className="mb-6">
        <p className="text-sm font-bold text-muted-foreground">{t("settings_profile")}</p>
        <h2 className="text-[32px] font-extrabold leading-tight text-secondary">{t("settings_interface_language")}</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {interfaceLanguageOptions.map((option) => {
          const isSelected = selected === option.value;
          return (
            <button key={option.value} type="button" onClick={() => onSelect(option.value)} className={isSelected ? "relative rounded-xl border-2 border-primary bg-card p-6 text-left [box-shadow:var(--shadow-card)]" : "relative rounded-xl border border-muted-foreground/30 bg-card p-6 text-left [box-shadow:var(--shadow-card)] transition hover:border-primary"}>
              {isSelected ? <span className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-4 w-4" aria-hidden="true" /></span> : null}
              <span className="block text-lg font-extrabold text-secondary">{t(option.titleKey)}</span>
              <span className="mt-2 block text-sm leading-6 text-muted-foreground">{t(option.descriptionKey)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function LanguagePreferencePanel({ selected, status, onSelect, onTest }: { selected: LanguagePreference; status: string; onSelect: (language: LanguagePreference) => void; onTest: (lang: LanguagePreference) => void }) {
  const { t } = useLanguage();
  const selectedOption = languageOptions.find((o) => o.value === selected);

  return (
    <section className="rounded-xl border border-secondary bg-card p-6 [box-shadow:var(--shadow-card)]">
      <div className="mb-6">
        <p className="text-sm font-bold text-muted-foreground">{t("settings_profile")}</p>
        <h2 className="text-[32px] font-extrabold leading-tight text-secondary">{t("settings_answer_language")}</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {languageOptions.map((option) => {
          const isSelected = selected === option.value;
          return (
            <button key={option.value} type="button" onClick={() => onSelect(option.value)} className={isSelected ? "relative rounded-xl border-2 border-primary bg-card p-6 text-left [box-shadow:var(--shadow-card)]" : "relative rounded-xl border border-muted-foreground/30 bg-card p-6 text-left [box-shadow:var(--shadow-card)] transition hover:border-secondary"}>
              {isSelected ? <span className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-4 w-4" aria-hidden="true" /></span> : null}
              <span className="text-3xl" aria-hidden="true">{option.icon}</span>
              <span className="mt-4 block text-lg font-extrabold text-secondary">{t(option.titleKey)}</span>
              <span className="mt-2 block text-sm leading-6 text-muted-foreground">{t(option.descriptionKey)}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          {selected === "english" ? "Answer language: " : "উত্তর ভাষা: "}
          <span className="font-extrabold text-secondary">{selectedOption ? `${selectedOption.icon} ${t(selectedOption.titleKey)}` : selected}</span>
        </p>
        <button type="button" onClick={() => onTest(selected)} className="inline-flex items-center gap-1.5 rounded-lg border border-secondary px-3 py-1.5 text-xs font-extrabold text-secondary transition hover:bg-secondary/10">
          {selected === "english" ? "🧪 Test Language" : "🧪 ভাষা পরীক্ষা করো"}
        </button>
      </div>
      {status ? <p className="mt-3 text-sm font-semibold text-secondary">{status}</p> : null}
    </section>
  );
}

function StudyBoard({ error, answer, question, imageDataUrl, confidence, reportStatus, isReporting, selectedLanguage, history, stepResult, activeTab, onLanguageChange, onReport }: { error: string; answer: string; question: string; imageDataUrl: string; confidence: ConfidenceLevel | ""; reportStatus: string; isReporting: boolean; selectedLanguage: LanguagePreference; history: StudyHistoryItem[]; stepResult: StepMarkingResult | null; activeTab: StudyTab; onLanguageChange: (language: LanguagePreference) => void; onReport: (reportType: ReportType) => void }) {
  const { t } = useLanguage();
  const [copyStatus, setCopyStatus] = useState<"" | "text" | "print">("");
  const answerContentRef = useRef<HTMLDivElement>(null);
  const confidenceMeta = confidence === "High"
    ? { className: "border-green-600 bg-green-50 text-green-700", label: t("confidence_high_full") }
    : confidence === "Low"
      ? { className: "border-red-600 bg-red-50 text-red-700", label: t("confidence_low_full") }
      : { className: "border-yellow-600 bg-yellow-50 text-yellow-700", label: t("confidence_medium_full") };

  function cleanTextForCopy(text: string): string {
    return text
      .replace(/\$\$([^$]+)\$\$/g, (_, math) => math.trim())
      .replace(/\$([^$]+)\$/g, (_, math) => math.trim())
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
      .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
      .replace(/\\sqrt([a-zA-Z0-9])/g, '√$1')
      .replace(/\\Rightarrow/g, '→')
      .replace(/\\rightarrow/g, '→')
      .replace(/\\times/g, '×')
      .replace(/\\cdot/g, '·')
      .replace(/\\pm/g, '±')
      .replace(/\\alpha/g, 'α')
      .replace(/\\beta/g, 'β')
      .replace(/\\gamma/g, 'γ')
      .replace(/\\theta/g, 'θ')
      .replace(/\\pi/g, 'π')
      .replace(/\\infty/g, '∞')
      .replace(/\\text\{([^}]+)\}/g, '$1')
      .replace(/\^2/g, '²')
      .replace(/\^3/g, '³')
      .replace(/_\{([^}]+)\}/g, '_$1')
      .replace(/\\[a-zA-Z]+/g, '')
      .replace(/[{}]/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/^#{1,6}\s/gm, '')
      .replace(/  +/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

function handleCopyText() {
    navigator.clipboard.writeText(cleanTextForCopy(answer));
    setCopyStatus("text");
    setTimeout(() => setCopyStatus(""), 2000);
  }

  function saveAnswerAsPDF() {
    if (!answerContentRef.current) {
      alert("উত্তর পাওয়া যায়নি");
      return;
    }

    const renderedAnswerHTML = answerContentRef.current.innerHTML;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;

    const watermarkGrid = Array.from({ length: 30 }, (_, i) => {
      const row = Math.floor(i / 4);
      const col = i % 4;
      const top = 5 + row * 15;
      const left = -5 + col * 28;
      return `<div class="wm-item" style="top:${top}%;left:${left}%;">🎓 PORALEKHA AI</div>`;
    }).join("");

    const imageSection = imageDataUrl ? `
      <div class="img-section">
        <h2 class="section-title">আপলোড করা ছবি:</h2>
        <img src="${imageDataUrl}" class="uploaded-img" alt="Uploaded question" />
      </div>` : "";

    const dateStr = new Date().toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" });

    const htmlContent = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8"/>
  <title>Poralekha AI - উত্তর</title>
  <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" integrity="sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV" crossorigin="anonymous"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Hind Siliguri', 'Inter', Arial, sans-serif; color: #1a2e4a; line-height: 2; font-size: 14px; background: white; padding: 0; }
    .page-content { max-width: 800px; margin: 0 auto; padding: 30px 40px; position: relative; z-index: 1; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #f5a623; padding-bottom: 18px; margin-bottom: 30px; }
    .logo-area { display: flex; align-items: center; gap: 12px; }
    .logo-icon { width: 48px; height: 48px; background: #1a2e4a; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #f5a623; }
    .logo-text { font-size: 22px; font-weight: 900; color: #1a2e4a; letter-spacing: -0.5px; }
    .logo-sub { font-size: 11px; color: #888; font-weight: 500; }
    .date-area { text-align: right; font-size: 12px; color: #666; line-height: 1.6; }
    .section-title { color: #1a2e4a; font-size: 16px; font-weight: 800; border-bottom: 2px solid #f5a623; padding-bottom: 8px; margin: 30px 0 15px 0; }
    .question-box { background: #faf8f3; border-left: 4px solid #f5a623; padding: 18px 20px; border-radius: 6px; line-height: 2; color: #1a2e4a; font-weight: 600; margin-bottom: 10px; }
    .img-section { margin: 20px 0; page-break-inside: avoid; }
    .uploaded-img { max-width: 100%; height: auto; display: block; border-radius: 8px; border: 1px solid #e0e0e0; margin: 10px auto; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .answer-content { line-height: 2.2; color: #333; font-size: 14px; }
    .answer-content p { margin-bottom: 14px; }
    .answer-content h1, .answer-content h2, .answer-content h3 { color: #1a2e4a; margin-top: 20px; margin-bottom: 12px; font-weight: 800; }
    .answer-content h1 { font-size: 20px; }
    .answer-content h2 { font-size: 18px; }
    .answer-content h3 { font-size: 16px; }
    .answer-content strong { color: #1a2e4a; font-weight: 700; }
    .answer-content ul, .answer-content ol { margin: 12px 0; padding-left: 30px; }
    .answer-content li { margin-bottom: 8px; }
    .answer-content code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 13px; color: #1a2e4a; }
    .answer-content pre { background: #f8f9fa; padding: 12px; border-radius: 6px; overflow-x: auto; margin: 12px 0; }
    .katex { font-size: 1.1em !important; color: #1a2e4a !important; }
    .katex-display { margin: 16px 0 !important; padding: 12px !important; background-color: #faf8f3 !important; border-radius: 8px; border-left: 3px solid #f5a623; overflow-x: auto; }
    .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #888; font-size: 11px; line-height: 1.8; }
    .footer strong { color: #1a2e4a; }
    .watermark-container { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 0; overflow: hidden; }
    .wm-item { position: absolute; transform: rotate(-35deg); font-size: 14px; font-weight: 900; color: rgba(245,166,35,0.18); white-space: nowrap; font-family: Arial, sans-serif; letter-spacing: 2px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page-content { padding: 15px 25px; }
      .watermark-container { position: fixed; }
      @page { size: A4; margin: 12mm; }
    }
  </style>
</head>
<body>
  <div class="watermark-container">${watermarkGrid}</div>
  <div class="page-content">
    <div class="header">
      <div class="logo-area">
        <div class="logo-icon">🎓</div>
        <div>
          <div class="logo-text">Poralekha AI</div>
          <div class="logo-sub">Learn with the pro</div>
        </div>
      </div>
      <div class="date-area">
        <div>${dateStr}</div>
        <div>poralekha.ai</div>
      </div>
    </div>
    <h2 class="section-title">প্রশ্ন:</h2>
    <div class="question-box">${question || "স্ক্রিনশট থেকে প্রশ্ন"}</div>
    ${imageSection}
    <h2 class="section-title">উত্তর:</h2>
    <div class="answer-content">${renderedAnswerHTML}</div>
    <div class="footer">
      <strong>Poralekha AI</strong> দ্বারা তৈরি — poralekha.ai<br/>
      এই উত্তর AI দ্বারা তৈরি। বই থেকে যাচাই করে নিন।
    </div>
  </div>
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 1500); };
    window.onafterprint = function() { window.close(); };
  </script>
</body>
</html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setCopyStatus("print");
    setTimeout(() => setCopyStatus(""), 1200);
  }

  return (
    <section className="min-h-[520px] rounded-xl border border-secondary bg-card p-6 [box-shadow:var(--shadow-card)]">
      <div className="mb-6 flex items-center justify-between gap-3 border-b border-secondary pb-5">
        <div>
          <p className="text-sm font-bold text-muted-foreground">{t("study_board_label")}</p>
          <h2 className="text-[32px] font-extrabold leading-tight text-secondary">{t("study_board_title")}</h2>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary">
          <BookOpen className="h-6 w-6" aria-hidden="true" />
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {languageOptions.map((option) => (
          <button key={option.value} type="button" onClick={() => onLanguageChange(option.value)} className={selectedLanguage === option.value ? "rounded-lg bg-primary px-3 py-2 text-xs font-extrabold text-primary-foreground" : "rounded-lg border border-muted-foreground/30 bg-card px-3 py-2 text-xs font-extrabold text-secondary transition hover:border-secondary"}>
            {t(option.pillKey)}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl border border-secondary bg-background p-4 text-sm font-semibold text-foreground">{error}</div>
      ) : stepResult ? (
        <StepMarkingResultView result={stepResult} />
      ) : answer ? (
        <div>
          {confidence ? <span className={`mb-4 inline-block rounded-lg border px-3 py-1.5 text-xs font-extrabold ${confidenceMeta.className}`}>{confidenceMeta.label}</span> : null}
          <div ref={answerContentRef} className="answer-content prose prose-sm max-w-none text-foreground prose-headings:text-secondary prose-strong:text-secondary prose-code:rounded-md prose-code:bg-background prose-code:px-1.5 prose-code:py-0.5 prose-code:text-secondary" style={{ height: "auto", maxHeight: "none", overflow: "visible", lineHeight: 2.0, letterSpacing: "0.3px", wordSpacing: "1.5px" }}>
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{answer}</ReactMarkdown>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-secondary pt-4 print:hidden">
<button type="button" onClick={handleCopyText} className="rounded-lg border border-secondary px-3 py-1.5 text-xs font-extrabold text-secondary transition hover:bg-secondary/10">
              {copyStatus === "text" ? "✅ টেক্সট কপি হয়েছে" : "📋 টেক্সট কপি করো"}
            </button>
            <button type="button" onClick={saveAnswerAsPDF} className="rounded-lg border border-secondary px-3 py-1.5 text-xs font-extrabold text-secondary transition hover:bg-secondary/10">
              {copyStatus === "print" ? "📄 PDF ডায়ালগ খুলছে..." : "💾 PDF সেভ করো"}
            </button>
            <select disabled={isReporting} defaultValue="" onChange={(event) => event.target.value && onReport(event.target.value as ReportType)} className="h-9 rounded-lg border border-secondary bg-card px-3 text-xs font-extrabold text-secondary outline-none focus:ring-2 focus:ring-ring">
              <option value="" disabled>{t("report_button")}</option>
              {reportOptions.map((option) => <option key={option.value} value={option.value}>{t(option.labelKey)}</option>)}
            </select>
            {reportStatus ? <span className="text-xs font-bold text-secondary">{reportStatus}</span> : null}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Feature icon={<Calculator className="h-5 w-5" />} title={t("feature_math_title")} text={t("feature_math_text")} />
          <Feature icon={<BookOpen className="h-5 w-5" />} title={t("feature_bangla_notes_title")} text={t("feature_bangla_notes_text")} />
          <Feature icon={<CheckCircle2 className="h-5 w-5" />} title={activeTab === "step_marking" ? t("feature_teacher_title") : t("feature_practice_short_title")} text={activeTab === "step_marking" ? t("feature_teacher_text") : t("feature_practice_short_text")} />
          <Feature icon={<Sparkles className="h-5 w-5" />} title={t("feature_exam_title")} text={t("feature_exam_text")} />
        </div>
      )}

      {history.length ? <HistoryList history={history} /> : null}
    </section>
  );
}

function HistoryList({ history }: { history: StudyHistoryItem[] }) {
  const { t } = useLanguage();

  return (
    <div className="mt-8 border-t border-secondary pt-5">
      <h3 className="mb-4 text-lg font-extrabold text-secondary">{t("history_recent")}</h3>
      <div className="grid gap-3">
        {history.map((item) => {
          const language = languageOptions.find((option) => option.value === item.language_used);
          return (
            <article key={item.id} className="rounded-xl border border-secondary/20 bg-background p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="line-clamp-1 text-sm font-extrabold text-secondary">{item.question}</p>
                <span className="shrink-0 rounded-lg bg-primary px-2.5 py-1 text-xs font-extrabold text-primary-foreground">{language ? t(language.pillKey) : t("answer_bangla_pill")}</span>
              </div>
              <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{item.answer}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function StepMarkingResultView({ result }: { result: StepMarkingResult }) {
  const { t } = useLanguage();
  const statusClass: Record<StepStatus, string> = {
    correct: "border-l-green-500",
    partial: "border-l-yellow-500",
    wrong: "border-l-red-500",
  };

  return (
    <div className="grid gap-4">
      {result.steps.map((step, index) => (
        <article key={`${step.step}-${index}`} className={`rounded-xl border border-secondary/20 border-l-4 bg-card p-4 [box-shadow:var(--shadow-card)] ${statusClass[step.status]}`}>
          <h3 className="text-base font-extrabold text-secondary flex flex-wrap items-baseline gap-1">
            <span>{t("step_number")} {index + 1}:</span>
            <MathRenderer inline text={step.step} className="answer-content" />
          </h3>
          <div className="answer-content mt-3 text-sm leading-7 text-muted-foreground">
            <MathRenderer text={step.feedback} />
          </div>
        </article>
      ))}
      <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-secondary pt-4">
        <span className="rounded-lg border border-primary bg-secondary px-4 py-2 text-lg font-extrabold text-primary">{t("step_score_label")}: {result.score}/10</span>
      </div>
      <div className="answer-content text-sm leading-7 text-muted-foreground">
        <MathRenderer text={result.overallFeedback} />
      </div>
      <details className="rounded-xl border border-secondary bg-background p-4">
        <summary className="cursor-pointer text-sm font-extrabold text-secondary">{t("step_full_solution")}</summary>
        <div className="answer-content prose prose-sm mt-4 max-w-none text-foreground prose-headings:text-secondary prose-strong:text-secondary" style={{ height: "auto", maxHeight: "none", overflow: "visible", lineHeight: 2.0, letterSpacing: "0.3px", wordSpacing: "1.5px" }}>
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{result.correctSolution}</ReactMarkdown>
        </div>
      </details>
    </div>
  );
}

function AccessPanel({ onAccessApproved }: { onAccessApproved: () => void }) {
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  function handleAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");

    if (!username.trim()) {
      setAuthError(t("auth_username_error"));
      return;
    }
    if (password !== "Admin") {
      setAuthError(t("auth_password_error"));
      return;
    }
    onAccessApproved();
  }

  return (
    <section className="mx-auto max-w-xl rounded-xl border border-secondary bg-card p-8 [box-shadow:var(--shadow-card)] sm:p-10">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-secondary text-primary">
          <LogIn className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="text-sm font-bold text-muted-foreground">{t("product_access")}</p>
        <h2 className="mt-2 text-[32px] font-extrabold leading-tight text-secondary">{t("login_title")}</h2>
      </div>

      <form onSubmit={handleAccess} className="grid gap-5">
        <label className="grid gap-2 text-sm font-bold text-secondary">
          {t("username_label")}
          <input required value={username} onChange={(event) => setUsername(event.target.value)} className="h-12 rounded-xl border border-secondary bg-background px-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" placeholder={t("username_placeholder")} />
        </label>
        <label className="grid gap-2 text-sm font-bold text-secondary">
          {t("password_label")}
          <input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 rounded-xl border border-secondary bg-background px-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" placeholder={t("password_placeholder")} />
        </label>

        {authError ? <p className="rounded-xl border border-secondary bg-background p-3 text-sm font-semibold text-foreground">{authError}</p> : null}

        <button type="submit" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-extrabold text-primary-foreground transition hover:opacity-90">
          <LogIn className="h-5 w-5" aria-hidden="true" />
          {t("login_button")}
        </button>
      </form>
    </section>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-secondary/20 bg-card p-6 [box-shadow:var(--shadow-card)]">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-secondary text-secondary">
        {icon}
      </div>
      <h3 className="text-lg font-extrabold text-secondary">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function PricingCard({ name, price, text, recommended }: { name: string; price: string; text: string; recommended: boolean }) {
  const { t } = useLanguage();

  return (
    <article className={recommended ? "rounded-xl border border-secondary bg-secondary p-6 text-secondary-foreground [box-shadow:var(--shadow-card)]" : "rounded-xl border border-secondary bg-card p-6 [box-shadow:var(--shadow-card)]"}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className={recommended ? "text-xl font-extrabold text-secondary-foreground" : "text-xl font-extrabold text-secondary"}>{name}</h3>
        {recommended ? <Star className="h-5 w-5 text-primary" aria-hidden="true" /> : null}
      </div>
      <p className={recommended ? "text-4xl font-extrabold text-secondary-foreground" : "text-4xl font-extrabold text-secondary"}>{price}</p>
      <p className={recommended ? "mt-4 min-h-12 text-sm leading-6 text-secondary-foreground/80" : "mt-4 min-h-12 text-sm leading-6 text-muted-foreground"}>{text}</p>
      <button type="button" className={recommended ? "mt-8 h-12 w-full rounded-xl bg-primary px-5 text-base font-extrabold text-primary-foreground transition hover:opacity-90" : "mt-8 h-12 w-full rounded-xl border border-secondary px-5 text-base font-extrabold text-secondary transition hover:text-primary"}>
        {t("choose_plan")}
      </button>
    </article>
  );
}
