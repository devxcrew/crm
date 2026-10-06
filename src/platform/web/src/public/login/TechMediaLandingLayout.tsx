import { ArrowRight, Building2, CheckCircle2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAppBrand } from "../../shared/brand/app-brand";

export function TechMediaLandingLayout({ children }: { children: ReactNode }) {
  const [slide, setSlide] = useState(0);
  const brand = useAppBrand();

  useEffect(() => {
    const timer = window.setInterval(
      () => setSlide((current) => (current + 1) % messages.length),
      4200
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="techmedia-login-page">
      <section className="techmedia-login-shell" aria-label={`${brand.title} Login`}>
        <div className="techmedia-login-story">
          <div className="techmedia-login-brand">
            <span className="auth-surface-mark" data-surface="app">
              <Logo />
              <span className="auth-surface-badge">
                <Building2 size={13} strokeWidth={2.25} />
              </span>
            </span>
            <span>
              <strong>{brand.title}</strong>
              <small>{brand.tagline}</small>
            </span>
          </div>
          <div className="techmedia-login-slider" aria-live="polite">
            <span className="techmedia-login-eyebrow">
              <CheckCircle2 size={14} /> Connected workspace
            </span>
            <p key={messages[slide]}>{messages[slide]}</p>
            <div className="techmedia-login-dots" aria-hidden="true">
              {messages.map((message, index) => (
                <span className={index === slide ? "is-active" : ""} key={message} />
              ))}
            </div>
          </div>
          <p className="techmedia-login-footnote">
            Enquiries, estimates, and follow-up in one focused desk <ArrowRight size={14} />
          </p>
        </div>
        <div className="techmedia-login-panel">
          <div className="techmedia-login-panel-brand" aria-hidden="true">
            <Logo />
            <span>{brand.title}</span>
          </div>
          <div className="auth-card-frame auth-card-frame-app techmedia-login-card-frame">
            <div className="auth-card techmedia-login-card">
              <header className="auth-card-header">
                <h1>Welcome back</h1>
                <p>{brand.tagline}</p>
              </header>
              {children}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Logo() {
  return (
    <>
      <img
        className="auth-logo-image techmedia-auth-logo-light"
        src="/logo/logo.svg"
        alt=""
        aria-hidden="true"
      />
      <img
        className="auth-logo-image techmedia-auth-logo-dark"
        src="/logo/logo-dark.svg"
        alt=""
        aria-hidden="true"
      />
    </>
  );
}

const messages = [
  "See every assigned enquiry without losing the next action.",
  "Create and update estimates directly in your workspace.",
  "Keep customer follow-up clear, current, and accountable."
];
