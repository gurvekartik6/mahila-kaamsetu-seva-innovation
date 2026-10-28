
import React, { useState } from 'react';
import PageHeading from '../components/PageHeading.jsx';
import FormField from '../components/FormField.jsx';

// Keep /api/assistant if your main backend proxies requests to FastAPI.
// Alternatively, set VITE_ASSISTANT_API_URL to your full FastAPI endpoint.
const ASSISTANT_API_URL =
  import.meta.env.VITE_ASSISTANT_API_URL || '/api/assistant';

export default function RequestPage(props) {
  const {
    t,
    form,
    updateForm,
    submitRequest,
    startVoice,
    voiceStatus,
    voiceText,
    language = 'mr',
  } = props;

  const [assistantQuestion, setAssistantQuestion] = useState('');
  const [assistantAnswer, setAssistantAnswer] = useState('');
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantError, setAssistantError] = useState('');
  const [assistantInfo, setAssistantInfo] = useState(null);

  const text = {
    mr: {
      title: 'KaamSetu AI सहाय्यक',
      intro: 'योजना, प्रशिक्षण किंवा सुरक्षिततेबद्दल प्रश्न विचारा.',
      placeholder: 'तुमचा प्रश्न येथे लिहा…',
      ask: 'AI ला विचारा',
      loading: 'उत्तर तयार होत आहे…',
      empty: 'कृपया किमान दोन अक्षरे लिहा.',
      unavailable: 'AI सहाय्यक सध्या उपलब्ध नाही. कृपया पुन्हा प्रयत्न करा.',
      disclaimer:
        'AI कडून मिळालेल्या माहितीची अधिकृत स्रोताकडून खात्री करा. आधार क्रमांक, OTP किंवा बँक पासवर्ड लिहू नका.',
      aiUsed: 'AI मॉडेलने उत्तर तयार केले.',
      fallback: 'उत्तर उपलब्ध माहितीनुसार तयार केले आहे; AI मॉडेल वापरले गेले नाही.',
      support: 'ही माहिती पुरेशी नसल्यास स्थानिक सहाय्यकाची मदत घ्या.',
    },
    hi: {
      title: 'KaamSetu AI सहायक',
      intro: 'योजनाओं, प्रशिक्षण या सुरक्षा के बारे में सवाल पूछें।',
      placeholder: 'अपना सवाल यहाँ लिखें…',
      ask: 'AI से पूछें',
      loading: 'जवाब तैयार हो रहा है…',
      empty: 'कृपया कम से कम दो अक्षर लिखें।',
      unavailable: 'AI सहायक अभी उपलब्ध नहीं है। कृपया फिर प्रयास करें।',
      disclaimer:
        'AI की जानकारी की आधिकारिक स्रोत से पुष्टि करें। आधार नंबर, OTP या बैंक पासवर्ड न लिखें।',
      aiUsed: 'जवाब AI मॉडल ने तैयार किया है।',
      fallback: 'जवाब उपलब्ध जानकारी से तैयार किया गया है; AI मॉडल का उपयोग नहीं हुआ।',
      support: 'जानकारी पर्याप्त न हो तो स्थानीय सहायक से मदद लें।',
    },
    en: {
      title: 'KaamSetu AI Assistant',
      intro: 'Ask about schemes, training, or personal safety.',
      placeholder: 'Type your question here…',
      ask: 'Ask AI',
      loading: 'Preparing your answer…',
      empty: 'Please enter at least two characters.',
      unavailable: 'The AI assistant is currently unavailable. Please try again.',
      disclaimer:
        'Verify information with an official source. Do not enter Aadhaar numbers, OTPs, or bank passwords.',
      aiUsed: 'An AI model generated this answer.',
      fallback: 'This answer uses available guidance; the AI model was not used.',
      support: 'If this information is insufficient, contact a local support worker.',
    },
  };

  const labels = text[language] || text.mr;

  async function askAssistant(event) {
    event.preventDefault();

    const message = assistantQuestion.trim();

    if (message.length < 2) {
      setAssistantError(labels.empty);
      setAssistantAnswer('');
      setAssistantInfo(null);
      return;
    }

    if (message.length > 3000) {
      setAssistantError('Please keep your question under 3000 characters.');
      return;
    }

    setAssistantBusy(true);
    setAssistantError('');
    setAssistantAnswer('');
    setAssistantInfo(null);

    try {
      const response = await fetch(ASSISTANT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          message,
          language,
        }),
      });

      // Read as text first so an HTML error page doesn't cause a JSON error.
      const responseText = await response.text();

      let data = {};

      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error(
            `The assistant API returned an invalid response (HTTP ${response.status}).`
          );
        }
      }

      if (!response.ok) {
        const detail =
          typeof data.detail === 'string'
            ? data.detail
            : typeof data.error === 'string'
              ? data.error
              : '';

        throw new Error(
          detail || `Assistant request failed (HTTP ${response.status}).`
        );
      }

      if (typeof data.answer !== 'string' || !data.answer.trim()) {
        throw new Error(
          'The assistant API responded, but no answer was returned.'
        );
      }

      setAssistantAnswer(data.answer.trim());

      setAssistantInfo({
        llmUsed: data.llmUsed === true,
        intent: data.intent || null,
        needsHumanSupport: data.needsHumanSupport === true,
        disclaimer:
          typeof data.disclaimer === 'string' ? data.disclaimer.trim() : '',
      });
    } catch (error) {
      console.error('KaamSetu assistant request failed:', error);

      if (error instanceof TypeError) {
        setAssistantError(
          'Could not connect to the assistant. Check your backend, API route, and network connection.'
        );
      } else {
        setAssistantError(error.message || labels.unavailable);
      }
    } finally {
      setAssistantBusy(false);
    }
  }

  return (
    <>
      <PageHeading
        eyebrow={t.navRequest}
        title={t.requestTitle}
        description={t.requestIntro}
      />

      <div className="two-col">
        {/* Support request form */}
        <form className="panel form-panel" onSubmit={submitRequest}>
          <FormField label={t.requestType}>
            <select
              value={form.type}
              onChange={(event) => updateForm('type', event.target.value)}
              required
            >
              <option value="">{t.chooseType}</option>
              <option value="work">{t.typeWork}</option>
              <option value="health">{t.typeHealth}</option>
              <option value="docs">{t.typeDocs}</option>
              <option value="saheli">{t.typeSaheli}</option>
              <option value="other">{t.typeOther}</option>
            </select>
          </FormField>

          <FormField label={t.description}>
            <textarea
              value={form.description}
              onChange={(event) =>
                updateForm('description', event.target.value)
              }
              placeholder={t.descriptionPlaceholder}
              required
              rows={4}
            />
            <small>{t.noSecrets}</small>
          </FormField>

          <FormField label={t.village}>
            <input
              value={form.village}
              onChange={(event) => updateForm('village', event.target.value)}
              placeholder={t.villagePlaceholder}
            />
          </FormField>

          <FormField label={t.reply}>
            <select
              value={form.reply}
              onChange={(event) => updateForm('reply', event.target.value)}
            >
              <option value="web">{t.replyWeb}</option>
              <option value="saheli">{t.replySaheli}</option>
              <option value="phone">{t.replyPhone}</option>
            </select>
          </FormField>

          <label className="consent">
            <input
              type="checkbox"
              checked={form.consent}
              onChange={(event) =>
                updateForm('consent', event.target.checked)
              }
              required
            />
            <span>{t.consent}</span>
          </label>

          <button className="btn primary full" type="submit">
            {t.submit}
          </button>
        </form>

        {/* Voice and AI assistance */}
        <div className="panel voice-panel">
          <div className="voice-icon" aria-hidden="true">
            🎙️
          </div>

          <h2>{t.voiceTitle}</h2>
          <p>{t.voiceText}</p>

          <button
            className="mic"
            type="button"
            onClick={startVoice}
            aria-label="Start voice input"
          >
            🎙️
          </button>

          <p className="voice-state" aria-live="polite">
            {voiceStatus === 'listening'
              ? t.listening
              : voiceStatus === 'unsupported'
                ? t.voiceUnsupported
                : t.voiceReady}
          </p>

          {voiceText && <blockquote>{voiceText}</blockquote>}

          <small>{t.voiceDisclaimer}</small>

          <hr />

          <h3>{labels.title}</h3>
          <p>{labels.intro}</p>

          <form onSubmit={askAssistant}>
            <textarea
              value={assistantQuestion}
              onChange={(event) => setAssistantQuestion(event.target.value)}
              rows={3}
              maxLength={3000}
              minLength={2}
              required
              disabled={assistantBusy}
              placeholder={labels.placeholder}
              aria-label={labels.placeholder}
            />

            <small>
              {assistantQuestion.length}/3000
            </small>

            <button
              className="btn primary full"
              type="submit"
              disabled={assistantBusy || assistantQuestion.trim().length < 2}
            >
              {assistantBusy ? labels.loading : labels.ask}
            </button>
          </form>

          {assistantBusy && (
            <p role="status" aria-live="polite">
              {labels.loading}
            </p>
          )}

          {assistantError && (
            <div className="assistant-error" role="alert">
              <p>{assistantError}</p>
              <button
                type="button"
                className="btn"
                onClick={askAssistant.bind(null, {
                  preventDefault() {},
                })}
                disabled={assistantBusy || assistantQuestion.trim().length < 2}
              >
                {language === 'mr'
                  ? 'पुन्हा प्रयत्न करा'
                  : language === 'hi'
                    ? 'फिर से प्रयास करें'
                    : 'Try again'}
              </button>
            </div>
          )}

          {assistantAnswer && (
            <section className="assistant-result" aria-live="polite">
              <h4>
                {language === 'mr'
                  ? 'तुमच्यासाठी उत्तर'
                  : language === 'hi'
                    ? 'आपके लिए जवाब'
                    : 'Your answer'}
              </h4>

              <blockquote
                className="assistant-answer"
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {assistantAnswer}
              </blockquote>

              {assistantInfo && (
                <div className="assistant-metadata">
                  <small>
                    {assistantInfo.llmUsed ? labels.aiUsed : labels.fallback}
                  </small>

                  {assistantInfo.needsHumanSupport && (
                    <p role="status">{labels.support}</p>
                  )}

                  {assistantInfo.disclaimer && (
                    <p>{assistantInfo.disclaimer}</p>
                  )}
                </div>
              )}

              <small>{labels.disclaimer}</small>
            </section>
          )}

          <hr />

          <h3>{t.tips}</h3>
          <ul>
            <li>{t.tipReview}</li>
            <li>{t.tipEmergency}</li>
            <li>{t.tipTruth}</li>
          </ul>
        </div>
      </div>
    </>
  );
}
