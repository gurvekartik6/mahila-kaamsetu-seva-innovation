import React, { useEffect, useMemo, useState } from "react";
import { getText, languages } from "./i18n.js";
import "./styles.css";
import HomePage from "./pages/HomePage.jsx";
import RequestPage from "./pages/RequestPage.jsx";
import OpportunitiesPage from "./pages/OpportunitiesPage.jsx";
import TrackingPage from "./pages/TrackingPage.jsx";
import DocumentsPage from "./pages/DocumentsPage.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import StaffDashboard from "./pages/StaffDashboard.jsx";
import GuidePage from "./pages/GuidePage.jsx";
import Header from "./components/Header.jsx";
import Sidebar from "./components/Sidebar.jsx";
import MobileNav from "./components/MobileNav.jsx";
import Toast from "./components/Toast.jsx";
import ModalHost from "./components/ModalHost.jsx";
import PublicSite from "./components/PublicSite.jsx";

const initialRequests = [];
const opportunityKeys = [
  {
    id: "sewing",
    kind: "training",
    title: "opportunity1",
    description: "opportunity1Text",
    icon: "🧵",
    location: "demoLocation",
  },
  {
    id: "food",
    kind: "work",
    title: "opportunity2",
    description: "opportunity2Text",
    icon: "🧺",
    location: "demoLocation",
  },
  {
    id: "shg",
    kind: "support",
    title: "opportunity3",
    description: "opportunity3Text",
    icon: "🌱",
    location: "demoGroup",
  },
  {
    id: "mobile",
    kind: "training",
    title: "opportunity4",
    description: "opportunity4Text",
    icon: "📱",
    location: "demoLocation",
  },
];

export default function App() {
  const [language, setLanguage] = useState(() => {
    try {
      const saved = localStorage.getItem("kaamsetu-language");
      return ["mr", "hi", "en"].includes(saved) ? saved : "mr";
    } catch {
      return "mr";
    }
  });
  const t = useMemo(() => getText(language), [language]);
  const [page, setPage] = useState("home");
  const [guideTab, setGuideTab] = useState("start");
  const [filter, setFilter] = useState("all");
  const [requests, setRequests] = useState(initialRequests);
  const [apiMode, setApiMode] = useState("checking");
  const [toast, setToast] = useState("");
  const [form, setForm] = useState({
    type: "",
    description: "",
    village: "",
    reply: "web",
    consent: false,
  });
  const [voiceText, setVoiceText] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("ready");
  const [modal, setModal] = useState(null);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "member",
  });
  const [authBusy, setAuthBusy] = useState(false);
  const [opportunities, setOpportunities] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [adminSummary, setAdminSummary] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [staffApplications, setStaffApplications] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);
  const [staffMessages, setStaffMessages] = useState([]);
  const [adminMessages, setAdminMessages] = useState([]);
  const [adminOpportunity, setAdminOpportunity] = useState({
    title: "",
    description: "",
    kind: "training",
    organisation: "",
    location: "",
    eligibility: "",
    compensation: "",
    applicationUrl: "",
    contact: "",
    language: "mr",
    verified: false,
    published: false,
  });

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem("kaamsetu-language", language);
    } catch {
      /* Storage may be disabled by the browser. */
    }
  }, [language]);
  useEffect(() => {
    let active = true;
    fetch("/api/health")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (active) setApiMode(data.database === "connected" ? "live" : "demo");
      })
      .catch(() => {
        if (active) setApiMode("demo");
      });
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(async (data) => {
        if (!active) return;
        setUser(data.user);
        if (data.user) {
          setPage(
            data.user.role === "admin"
              ? "admin"
              : data.user.role === "staff"
                ? "staff"
                : "home",
          );
          const rr = await fetch("/api/requests");
          if (rr.ok) {
            const rd = await rr.json();
            if (active) setRequests(rd.requests || []);
          }
          const dr = await fetch("/api/documents");
          if (dr.ok) {
            const dd = await dr.json();
            if (active) setDocuments(dd.documents || []);
          }
        }
      })
      .catch(() => {});
    fetch("/api/opportunities")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (active) setOpportunities(data.opportunities || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  function notify(message) {
    setToast(message);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(""), 3200);
  }
  function go(next) {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function updateForm(key, value) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  async function submitRequest(event) {
    event.preventDefault();
    if (!form.type || !form.description.trim() || !form.consent) {
      notify(t.error);
      return;
    }
    const payload = {
      type: form.type,
      description: form.description.trim(),
      village: form.village.trim(),
      replyPreference: form.reply,
      language,
    };
    if (!user) {
      setAuthMode("login");
      setModal({ kind: "auth", title: t.signInTitle, body: t.signInRequired });
      return;
    }
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t.error);
      setRequests((old) => [data.request, ...old]);
      setForm({
        type: "",
        description: "",
        village: "",
        reply: "web",
        consent: false,
      });
      notify(t.requestCreated);
      go("tracking");
    } catch (error) {
      notify(error.message || t.error);
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthBusy(true);
    try {
      const staffApplication =
        authMode === "register" && authForm.role === "staff";
      const endpoint = staffApplication
        ? "/api/auth/staff-apply"
        : `/api/auth/${authMode === "register" ? "register" : "login"}`;
      const payload =
        authMode === "register"
          ? {
              fullName: authForm.fullName,
              email: authForm.email,
              password: authForm.password,
              language,
              ...(staffApplication
                ? {
                    experience: authForm.experience || "",
                    villageOrArea: authForm.villageOrArea || "",
                    reason: authForm.reason || "",
                  }
                : {}),
            }
          : {
              email: authForm.email,
              password: authForm.password,
              expectedRole: authForm.role,
              language,
            };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t.error);
      if (staffApplication) {
        setModal(null);
        setAuthForm({
          fullName: "",
          email: "",
          password: "",
          role: "member",
          experience: "",
          villageOrArea: "",
          reason: "",
        });
        notify(
          data.message ||
            "Staff application submitted. Wait for administrator approval before signing in.",
        );
        return;
      }
      setUser(data.user);
      setPage(
        data.user.role === "admin"
          ? "admin"
          : data.user.role === "staff"
            ? "staff"
            : "home",
      );
      setModal(null);
      setAuthForm({
        fullName: "",
        email: "",
        password: "",
        role: "member",
        experience: "",
        villageOrArea: "",
        reason: "",
      });
      notify(t.signedIn);
      if (data.user.role === "member") {
        const requestsResponse = await fetch("/api/requests");
        if (requestsResponse.ok) {
          const result = await requestsResponse.json();
          setRequests(result.requests || []);
        }
        const documentsResponse = await fetch("/api/documents");
        if (documentsResponse.ok) {
          const result = await documentsResponse.json();
          setDocuments(result.documents || []);
        }
      }
    } catch (error) {
      notify(error.message || t.error);
    } finally {
      setAuthBusy(false);
    }
  }

  async function loadAdmin() {
    if (user?.role !== "admin") return;
    try {
      const [
        summaryResponse,
        usersResponse,
        auditResponse,
        messagesResponse,
        applicationsResponse,
        requestsResponse,
      ] = await Promise.all([
        fetch("/api/admin/summary"),
        fetch("/api/admin/users"),
        fetch("/api/admin/audit"),
        fetch("/api/admin/staff-messages"),
        fetch("/api/admin/staff-applications"),
        fetch("/api/requests"),
      ]);
      const summary = await summaryResponse.json();
      if (!summaryResponse.ok) throw new Error(summary.error || t.error);
      setAdminSummary(summary);
      if (usersResponse.ok)
        setAdminUsers((await usersResponse.json()).users || []);
      if (auditResponse.ok)
        setAdminLogs((await auditResponse.json()).logs || []);
      if (messagesResponse.ok)
        setAdminMessages((await messagesResponse.json()).messages || []);
      if (applicationsResponse.ok)
        setStaffApplications(
          (await applicationsResponse.json()).applications || [],
        );
      if (requestsResponse.ok)
        setRequests((await requestsResponse.json()).requests || []);
    } catch (error) {
      notify(error.message || t.error);
    }
  }
  async function loadStaff() {
    if (user?.role !== "staff") return;
    try {
      const [requestResponse, messageResponse] = await Promise.all([
        fetch("/api/requests"),
        fetch("/api/staff/messages"),
      ]);
      const requestData = await requestResponse.json();
      if (!requestResponse.ok) throw new Error(requestData.error || t.error);
      setRequests(requestData.requests || []);
      if (messageResponse.ok)
        setStaffMessages((await messageResponse.json()).messages || []);
    } catch (error) {
      notify(error.message || t.error);
    }
  }
  async function reviewStaffApplication(id, decision) {
    try {
      const response = await fetch(`/api/admin/staff-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t.error);
      notify(
        decision === "approve"
          ? "Staff application approved. The applicant can now sign in as staff."
          : "Staff application rejected.",
      );
      await loadAdmin();
    } catch (error) {
      notify(error.message || t.error);
    }
  }

  async function sendStaffMessage(event, payload) {
    event.preventDefault();
    const formElement = event.currentTarget;
    try {
      const r = await fetch("/api/staff/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || t.error);
      setStaffMessages((old) => [d.message, ...old]);
      notify("Message sent to administrator.");
      formElement.reset();
    } catch (e) {
      notify(e.message || t.error);
    }
  }
  async function replyStaffMessage(id, reply, status = "answered") {
    try {
      const r = await fetch(`/api/admin/staff-messages/${id}/reply`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply, status }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || t.error);
      setAdminMessages((old) => old.map((m) => (m.id === id ? d.message : m)));
      notify("Administrator response saved.");
    } catch (e) {
      notify(e.message || t.error);
    }
  }
  async function updateRequestStatus(request, status) {
    try {
      const r = await fetch(
        `/api/requests/${encodeURIComponent(request.id)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, staffNote: request.staffNote || "" }),
        },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || t.error);
      setRequests((old) =>
        old.map((x) => (x.id === request.id ? d.request : x)),
      );
      notify(t.saved);
    } catch (e) {
      notify(e.message || t.error);
    }
  }
  async function createOpportunity(event) {
    event.preventDefault();
    try {
      const r = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adminOpportunity),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || t.error);
      setOpportunities((old) => [d.opportunity, ...old]);
      setAdminOpportunity({
        title: "",
        description: "",
        kind: "training",
        organisation: "",
        location: "",
        eligibility: "",
        compensation: "",
        applicationUrl: "",
        contact: "",
        language,
        verified: false,
        published: false,
      });
      notify(t.saved);
      loadAdmin();
    } catch (e) {
      notify(e.message || t.error);
    }
  }
  async function uploadDocument(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      notify(t.fileTooLarge);
      event.target.value = "";
      return;
    }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      notify(t.fileType);
      event.target.value = "";
      return;
    }
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const r = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          mimeType: file.type,
          contentBase64: base64,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || t.error);
      setDocuments((old) => [d.document, ...old]);
      notify(t.saved);
    } catch (e) {
      notify(e.message || t.error);
    } finally {
      event.target.value = "";
    }
  }
  async function deleteDocument(id) {
    try {
      const r = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || t.error);
      setDocuments((old) => old.filter((x) => x.id !== id));
      notify(t.deleted);
    } catch (e) {
      notify(e.message || t.error);
    }
  }

  function startVoice() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus("unsupported");
      notify(t.voiceUnsupported);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "mr-IN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => setVoiceStatus("listening");
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setVoiceText(text);
      updateForm("description", text);
      setVoiceStatus("ready");
    };
    recognition.onerror = () => {
      setVoiceStatus("unsupported");
    };
    recognition.onend = () =>
      setVoiceStatus((old) => (old === "listening" ? "ready" : old));
    try {
      recognition.start();
    } catch {
      setVoiceStatus("unsupported");
    }
  }

  useEffect(() => {
    if (page === "admin" && user?.role === "admin") loadAdmin();
    if (page === "staff" && user?.role === "staff") loadStaff();
  }, [page, user?.id]);

  const navItems =
    user?.role === "admin"
      ? [["admin", "⚙", "Admin dashboard"]]
      : user?.role === "staff"
        ? [["staff", "💼", "Staff workspace"]]
        : [
            ["home", "⌂", t.navHome],
            ["request", "◉", t.navRequest],
            ["opportunities", "✿", t.navWork],
            ["tracking", "↗", t.navTrack],
            ["documents", "▤", t.navDocs],
            ["guide", "ⓘ", t.navGuide],
          ];
  const guideContent = {
    start: [t.guide1Title, t.guide1Text, "request"],
    request: [t.guide2Title, t.guide2Text, "request"],
    work: [t.guide3Title, t.guide3Text, "opportunities"],
    track: [t.guide4Title, t.guide4Text, "tracking"],
    safety: [t.guide5Title, t.guide5Text, "documents"],
  };
  const selectedGuide = guideContent[guideTab];
  const pageProps = {
    t,
    language,
    requests,
    opportunities,
    apiMode,
    go,
    setForm,
    form,
    updateForm,
    submitRequest,
    startVoice,
    voiceStatus,
    voiceText,
    filter,
    setFilter,
    opportunityKeys,
    uploadDocument,
    documents,
    deleteDocument,
    loadAdmin,
    loadStaff,
    adminSummary,
    updateRequestStatus,
    createOpportunity,
    adminOpportunity,
    setAdminOpportunity,
    user,
    adminUsers,
    setAdminUsers,
    adminLogs,
    staffApplications,
    reviewStaffApplication,
    staffMessages,
    adminMessages,
    sendStaffMessage,
    replyStaffMessage,
    notify,
    guideTab,
    setGuideTab,
    selectedGuide,
  };

  if (!user)
    return (
      <>
        <PublicSite
          language={language}
          setLanguage={setLanguage}
          opportunities={opportunities}
          onAuth={(mode) => {
            setAuthMode(mode);
            setAuthForm((current) => ({ ...current, role: "member" }));
            setModal({
              kind: "auth",
              title: mode === "register" ? t.createAccount : t.signInTitle,
              body:
                mode === "register"
                  ? "Members can register immediately. Staff must submit an application and wait for administrator approval. Administrator accounts are not publicly registered."
                  : t.signInRequired,
            });
          }}
        />
        <Toast message={toast} />
        <ModalHost
          modal={modal}
          setModal={setModal}
          t={t}
          authMode={authMode}
          setAuthMode={setAuthMode}
          authForm={authForm}
          setAuthForm={setAuthForm}
          authBusy={authBusy}
          handleAuthSubmit={handleAuthSubmit}
        />
      </>
    );

  return (
    <div className="app-shell">
      <Header
        t={t}
        languages={languages}
        language={language}
        setLanguage={setLanguage}
        apiMode={apiMode}
        user={user}
        go={go}
        onAuthAction={() =>
          user
            ? fetch("/api/auth/logout", { method: "POST" }).finally(() => {
                setUser(null);
                setPage("home");
                setRequests([]);
                setDocuments([]);
                setAdminUsers([]);
                setStaffApplications([]);
                notify(t.signedOut);
              })
            : (setAuthMode("login"),
              setModal({
                kind: "auth",
                title: t.signInTitle,
                body: t.signInRequired,
              }))
        }
      />
      <div className="layout">
        <Sidebar t={t} user={user} navItems={navItems} page={page} go={go} />
        <main>
          {user?.role === "member" && page === "home" && (
            <HomePage {...pageProps} />
          )}
          {user?.role === "member" && page === "request" && (
            <RequestPage {...pageProps} />
          )}
          {user?.role === "member" && page === "opportunities" && (
            <OpportunitiesPage {...pageProps} />
          )}
          {user?.role === "member" && page === "tracking" && (
            <TrackingPage {...pageProps} />
          )}
          {user?.role === "member" && page === "documents" && (
            <DocumentsPage {...pageProps} />
          )}
          {page === "admin" && user?.role === "admin" && (
            <AdminDashboard {...pageProps} />
          )}
          {page === "staff" && user?.role === "staff" && (
            <StaffDashboard {...pageProps} />
          )}
          {user?.role === "member" && page === "guide" && (
            <GuidePage {...pageProps} />
          )}
          <footer>{t.footer}</footer>
        </main>
      </div>
      <MobileNav t={t} user={user} navItems={navItems} page={page} go={go} />
      <Toast message={toast} />
      <ModalHost
        modal={modal}
        setModal={setModal}
        t={t}
        authMode={authMode}
        setAuthMode={setAuthMode}
        authForm={authForm}
        setAuthForm={setAuthForm}
        authBusy={authBusy}
        handleAuthSubmit={handleAuthSubmit}
      />
    </div>
  );
}
