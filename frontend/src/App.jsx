import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import axios from "axios";

const API_URL = "http://127.0.0.1:8000";
const CASE_TYPES = ["Criminal", "Family", "Civil", "Property", "Consumer", "Corporate", "Other"];

const emptyCase = {
  case_title: "",
  case_type: "Criminal",
  case_number: "",
  parties_involved: "",
  description: "",
  status: "Pending",
};

function App() {

  const [page, setPage] = useState("login");
  const [selectedType, setSelectedType] = useState("Criminal");
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [caseForm, setCaseForm] = useState(emptyCase);
  const [evidenceForm, setEvidenceForm] = useState({
    description: "",
    uploaded_by: "",
    file: null,
  });
  const [transcript, setTranscript] = useState("");
  const [evidence, setEvidence] = useState([]);
  const [hearings, setHearings] = useState([]);
  const [report, setReport] = useState(null);
  const [meetingLink, setMeetingLink] = useState("");
  const [message, setMessage] = useState("Backend connected. Ready for case review.");
  const [user, setUser] = useState(null);
  const jitsiApiRef = useRef(null);

  const selectedCase = useMemo(
    () => cases.find((caseItem) => caseItem.id === selectedCaseId),
    [cases, selectedCaseId]
  );

  const casesByType = useMemo(
    () => cases.filter((caseItem) => caseItem.case_type === selectedType),
    [cases, selectedType]
  );
  
  function getCaseRoomName() {
    const baseName = selectedCase
      ? `AI-Judge-${selectedCase.case_type}-${selectedCase.case_number}-${selectedCase.case_title}`
      : "AI-Judge-Demo-Room";

    return baseName
      .replace(/[^a-zA-Z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
  }

  function startJitsiMeet() {
    const container = document.getElementById("jitsi-container");

    if (!selectedCase) {
      setMessage("Open a case before starting an online meeting.");
      return;
    }

    if (!container) return;

    if (!window.JitsiMeetExternalAPI) {
      setMessage("Jitsi could not load. Check internet connection and refresh the page.");
      return;
    }

    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
      jitsiApiRef.current = null;
    }

    container.innerHTML = "";

    const roomName = getCaseRoomName();
    const link = `https://meet.jit.si/${roomName}`;

    const options = {
      roomName,
      width: "100%",
      height: 520,
      parentNode: container,
      userInfo: {
        displayName: user?.name || "AI Judge User",
      },
      configOverwrite: {
        prejoinPageEnabled: true,
        startWithAudioMuted: true,
        startWithVideoMuted: false,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
      },
    };

    jitsiApiRef.current = new window.JitsiMeetExternalAPI("meet.jit.si", options);
    setMeetingLink(link);
    setMessage("Online meeting room started for this case.");
  }

  function endJitsiMeet() {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
      jitsiApiRef.current = null;
    }

    const container = document.getElementById("jitsi-container");
    if (container) container.innerHTML = "";

    setMeetingLink("");
    setMessage("Online meeting ended.");
  }

  useEffect(() => {
    loadCases();
  }, []);

  useEffect(() => {
    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedCaseId) return;
    loadEvidence(selectedCaseId);
    loadHearings(selectedCaseId);
    setReport(null);
  }, [selectedCaseId]);

  async function loadCases() {
    try {
      const response = await fetch(`${API_URL}/cases`);
      const data = await response.json();
      setCases(data);
      if (data.length && !selectedCaseId) setSelectedCaseId(data[0].id);
    } catch {
      setMessage("Start the backend first: uvicorn app.main:app --reload");
    }
  }

  async function loadEvidence(caseId) {
    const response = await fetch(`${API_URL}/cases/${caseId}/evidence`);
    setEvidence(await response.json());
  }

  async function loadHearings(caseId) {
    const response = await fetch(`${API_URL}/cases/${caseId}/hearings`);
    setHearings(await response.json());
  }

  async function createCase(event) {
    event.preventDefault();
    const response = await fetch(`${API_URL}/cases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(caseForm),
    });
    const data = await response.json();
    setCaseForm(emptyCase);
    setSelectedCaseId(data.case.id);
    setSelectedType(data.case.case_type);
    setPage("case-detail");
    setMessage("Case file saved. You can now upload files, add hearings, or generate reports.");
    loadCases();
  }

  async function uploadEvidence(event) {
    event.preventDefault();
    if (!selectedCaseId || !evidenceForm.file) {
      setMessage("Select a case and choose an evidence file first.");
      return;
    }

    const formData = new FormData();
    formData.append("case_id", selectedCaseId);
    formData.append("description", evidenceForm.description);
    formData.append("uploaded_by", evidenceForm.uploaded_by);
    formData.append("file", evidenceForm.file);

    await fetch(`${API_URL}/evidence/upload`, {
      method: "POST",
      body: formData,
    });

    setEvidenceForm({ description: "", uploaded_by: "", file: null });
    setMessage("Evidence uploaded and summarized in demo mode.");
    loadEvidence(selectedCaseId);
  }

  async function addHearing(event) {
    event.preventDefault();
    if (!selectedCaseId || !transcript.trim()) {
      setMessage("Select a case and paste the hearing transcript first.");
      return;
    }

    await fetch(`${API_URL}/hearings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id: selectedCaseId, transcript }),
    });

    setTranscript("");
    setMessage("Hearing transcript analyzed. Mood chart prepared.");
    loadHearings(selectedCaseId);
  }

  async function generateReport() {
    if (!selectedCaseId) {
      setMessage("Create or select a case before generating a report.");
      return;
    }
    const response = await fetch(`${API_URL}/cases/${selectedCaseId}/case-report`);
    setReport(await response.json());
    setMessage("Case report and decision explanation generated.");
  }

  const handleGoogleLoginSuccess = (credentialResponse) => {
    try {
      // Decode the JWT token to get user info
      const base64Url = credentialResponse.credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const userData = JSON.parse(jsonPayload);
      
      // Store user info
      setUser({
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
      });
      
      setMessage(`Welcome ${userData.name}! You are now logged in with Gmail.`);
      setPage("case-types");
    } catch (error) {
      console.error('Login error:', error);
      setMessage("Login failed. Please try again.");
    }
  };

  const handleGoogleLoginError = () => {
    setMessage("Login failed. Please try again.");
  };

  const handleLogout = () => {
    setUser(null);
    setPage("login");
    setMessage("You have been logged out.");
  };

  const latestMood =
    report?.mood_report || hearings[hearings.length - 1]?.mood_chart || {
      Neutral: 45,
      Stressed: 25,
      Confident: 15,
      Angry: 10,
      Sad: 5,
    };

  function goToAddCase(type = selectedType) {
    setCaseForm({ ...emptyCase, case_type: type });
    setSelectedType(type);
    setPage("add-case");
  }

  function openCase(caseId) {
    setSelectedCaseId(caseId);
    setPage("case-detail");
  }

  if (page === "login") {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="seal large-seal">
            <span>AI</span>
            <small>Justice Desk</small>
          </div>
          <p className="eyebrow">AI-assisted judicial review</p>
          <h1>AI Judge Chamber</h1>
          <p className="login-copy">
            Sign in with your Gmail account to manage case files, evidence, hearing notes, and AI reports.
          </p>
          <div className="google-login-container">
            <GoogleLogin
              onSuccess={handleGoogleLoginSuccess}
              onError={handleGoogleLoginError}
              text="signin_with"
              size="large"
            />
          </div>
          <small className="muted">Secure login powered by Google OAuth</small>
        </section>
      </main>
    );
  }

  if (page === "case-types") {
    return (
      <main className="court-app">
        <header className="topbar">
          <div>
            <p className="eyebrow">Case Registry</p>
            <h1>All Case Types</h1>
            {user && <p className="user-info">Logged in as: {user.email}</p>}
          </div>
          <button onClick={handleLogout}>Logout</button>
        </header>

        <section className="type-grid">
          {CASE_TYPES.map((type) => {
            const count = cases.filter((caseItem) => caseItem.case_type === type).length;
            return (
              <button
                key={type}
                className={type === selectedType ? "type-card active" : "type-card"}
                onClick={() => setSelectedType(type)}
              >
                <strong>{type}</strong>
                <span>{count} case{count === 1 ? "" : "s"}</span>
              </button>
            );
          })}
        </section>

        <section className="panel docket-page">
          <div className="section-head">
            <div>
              <h2>{selectedType} Cases</h2>
              <p className="muted">Open a case to view files, reports, and meeting options.</p>
            </div>
          </div>

          <div className="case-table">
            {casesByType.length === 0 && <p className="muted">No cases under {selectedType} yet.</p>}
            {casesByType.map((caseItem) => (
              <button className="case-row" key={caseItem.id} onClick={() => openCase(caseItem.id)}>
                <strong>{caseItem.case_title}</strong>
                <span>{caseItem.case_number}</span>
                <small>{caseItem.status}</small>
              </button>
            ))}
          </div>
        </section>

        <button className="floating-add" onClick={() => goToAddCase()}>
          + Add Case
        </button>
      </main>
    );
  }

  if (page === "add-case") {
    return (
      <main className="court-app narrow-page">
        <header className="topbar">
          <div>
            <p className="eyebrow">New case entry</p>
            <h1>Add Case</h1>
          </div>
          <button onClick={() => setPage("case-types")}>Back</button>
        </header>

        <section className="panel">
          <h2>Case Details</h2>
          <form onSubmit={createCase} className="form-grid">
            <input
              placeholder="Case title"
              value={caseForm.case_title}
              onChange={(event) =>
                setCaseForm({ ...caseForm, case_title: event.target.value })
              }
              required
            />
            <select
              value={caseForm.case_type}
              onChange={(event) =>
                setCaseForm({ ...caseForm, case_type: event.target.value })
              }
            >
              {CASE_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
            <input
              placeholder="Case number"
              value={caseForm.case_number}
              onChange={(event) =>
                setCaseForm({ ...caseForm, case_number: event.target.value })
              }
              required
            />
            <input
              placeholder="Parties involved"
              value={caseForm.parties_involved}
              onChange={(event) =>
                setCaseForm({ ...caseForm, parties_involved: event.target.value })
              }
              required
            />
            <textarea
              className="large-textarea"
              placeholder="Case description"
              value={caseForm.description}
              onChange={(event) =>
                setCaseForm({ ...caseForm, description: event.target.value })
              }
              required
            />
            <button type="submit">Save Case</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="court-app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Case workspace</p>
          <h1>{selectedCase ? selectedCase.case_title : "Case File"}</h1>
          <p className="muted">
            {selectedCase ? `${selectedCase.case_type} | ${selectedCase.case_number}` : "Select a case first"}
          </p>
        </div>
        <button onClick={() => setPage("case-types")}>Back To Cases</button>
      </header>

      <div className="status-bar">{message}</div>

      <section className="dashboard">
        <article className="stat">
          <span>{cases.length}</span>
          <p>Total Cases</p>
        </article>
        <article className="stat">
          <span>{evidence.length}</span>
          <p>Evidence Files</p>
        </article>
        <article className="stat">
          <span>{hearings.length}</span>
          <p>Hearings</p>
        </article>
        <article className="stat">
          <span>{report ? "Ready" : "Draft"}</span>
          <p>Report Status</p>
        </article>
      </section>

      <section className="workspace">
        <div className="panel">
          <h2>Case File Uploads</h2>
          <p className="selected-case">
            Selected: {selectedCase ? selectedCase.case_title : "No case selected"}
          </p>
          <form onSubmit={uploadEvidence} className="form-grid">
            <input
              placeholder="Uploaded by"
              value={evidenceForm.uploaded_by}
              onChange={(event) =>
                setEvidenceForm({ ...evidenceForm, uploaded_by: event.target.value })
              }
              required
            />
            <input
              placeholder="Evidence description"
              value={evidenceForm.description}
              onChange={(event) =>
                setEvidenceForm({ ...evidenceForm, description: event.target.value })
              }
              required
            />
            <input
              type="file"
              onChange={(event) =>
                setEvidenceForm({ ...evidenceForm, file: event.target.files[0] })
              }
              required
            />
            <button type="submit">Upload Evidence</button>
          </form>

          <div className="evidence-list">
            {evidence.map((item) => (
              <article key={item.id}>
                <strong>{item.file_name}</strong>
                <p>{item.ai_summary.summary}</p>
                <small>Importance: {item.ai_summary.importance}</small>
              </article>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>Online Meet / Hearing</h2>
          <div className="meet-box">
            <strong>Online meeting room</strong>
            <p>Start a secure case hearing room using Jitsi Meet, then paste the final transcript below.</p>
            <div className="meet-actions">
              <button type="button" onClick={startJitsiMeet}>
                Start Online Meet
              </button>
              <button type="button" className="secondary-button" onClick={endJitsiMeet}>
                End Meet
              </button>
            </div>
            {meetingLink && (
              <a className="meeting-link" href={meetingLink} target="_blank" rel="noreferrer">
                Open/share meeting link
              </a>
            )}
            <div id="jitsi-container" className="jitsi-container"></div>
          </div>
          <form onSubmit={addHearing} className="form-grid">
            <textarea
              className="large-textarea"
              placeholder="Paste hearing conversation or meeting transcript here"
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
            />
            <button type="submit">Analyze Hearing</button>
          </form>
        </div>
      </section>

      <section className="report-layout">
        <div className="panel">
          <div className="report-header">
            <h2>AI Reports</h2>
            <button onClick={generateReport}>Generate Reports</button>
          </div>

          {report ? (
            <div className="report-box">
              <h3>Case Report</h3>
              <p>{report.case_report.case_summary}</p>
              <ul>
                {report.case_report.key_findings.map((finding) => (
                  <li key={finding}>{finding}</li>
                ))}
              </ul>
              <h3>Decision Explanation</h3>
              <p>{report.decision_explanation_report.why_this_decision}</p>
              <p className="warning">{report.decision_explanation_report.important_warning}</p>
            </div>
          ) : (
            <p className="muted">Generate a report after adding case details and evidence.</p>
          )}
        </div>

        <div className="panel mood-panel">
          <h2>Session Mood Chart</h2>
          <div className="pie-chart" />
          <div className="legend">
            {Object.entries(latestMood).map(([label, value]) => (
              <span key={label}>
                <i className={`dot ${label.toLowerCase()}`} />
                {label}: {value}%
              </span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
