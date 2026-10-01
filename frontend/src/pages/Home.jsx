import { Link } from "react-router-dom";
import { ArrowRight, KeyRound, PlusCircle, Swords, Mail } from "lucide-react";

const cards = [
  {
    icon: PlusCircle,
    title: "Create a Battle Room",
    text: "Create questions, set limits and configure room rules.",
    action: "Create Room",
    to: "/battle-room/create",
  },
  {
    icon: KeyRound,
    title: "Join a Battle",
    text: "Enter a six-character room key to participate.",
    action: "Join Room",
    to: "/battle-room",
  },
  {
    icon: Mail,
    title: "Contact Us",
    text: "Get in touch for support, partnerships and enquiries.",
    action: "Send an Enquiry",
    to: "mailto:helloamux@gmail.com?subject=CodeClash%20Enquiry",
  },
];

export default function Home() {
  return (
    <main className="home-page">
      <style>{`
        .home-page {
          width: 100%;
          max-width: 1600px;
          margin: 0 auto;
          padding: 20px clamp(20px, 4vw, 64px) 36px;
          font-family: var(--font-ui);
          color: var(--text-primary);
          box-sizing: border-box;
        }

        .home-page * {
          box-sizing: border-box;
        }

        /* HERO */

        
/* HERO */
.home-hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  padding: clamp(22px, 3vw, 40px);
  margin-bottom: 24px;
  border: 1px solid rgba(59,130,246,.2);
  border-radius: 16px;
  background:
    radial-gradient(
      ellipse at 88% 12%,
      rgba(0,119,255,.23),
      transparent 37%
    ),
    radial-gradient(
      ellipse at 10% 100%,
      rgba(0,212,255,.10),
      transparent 40%
    ),
    linear-gradient(
      120deg,
      #050b1c 0%,
      #07132e 55%,
      #071027 100%
    );
  box-shadow: 0 12px 35px rgba(0,0,0,.12);
}

/* Grid background */
.home-hero::before {
  content: "";
  position: absolute;
  z-index: -1;
  inset: 0;
  opacity: .17;
  background-image:
    linear-gradient(rgba(76,140,255,.18) 1px, transparent 1px),
    linear-gradient(90deg, rgba(76,140,255,.18) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: linear-gradient(90deg, black, transparent 85%);
  pointer-events: none;
}

/* Animated circular rings */
.home-hero::after {
  content: "";
  position: absolute;
  z-index: -1;
  width: 240px;
  height: 240px;
  right: 5%;
  top: 50%;
  transform: translateY(-50%);
  border: 1px solid rgba(0,196,255,.22);
  border-radius: 50%;
  box-shadow:
    0 0 0 30px rgba(0,140,255,.045),
    0 0 0 60px rgba(0,140,255,.03),
    0 0 35px rgba(0,140,255,.12);
  opacity: .7;
  pointer-events: none;
  transition: opacity .4s ease;
}

/* Animate rings on hover */
@keyframes home-ring-motion {
  0% {
    transform: translateY(-50%) rotate(0deg) scale(1);
  }
  50% {
    transform: translateY(-50%) rotate(180deg) scale(1.13);
  }
  100% {
    transform: translateY(-50%) rotate(360deg) scale(1);
  }
}

.home-hero:hover::after {
  animation: home-ring-motion 5s linear infinite;
  opacity: 1;
}

/* Hero content */
.home-hero-content {
  position: relative;
  z-index: 1;
  max-width: 760px;
}

.home-eyebrow {
  margin-bottom: 14px;
}

.home-hero h1 {
  max-width: 700px;
  margin: 0 0 10px;
  color: #f8fafc;
  font-size: clamp(30px, 4.5vw, 52px);
  font-weight: 800;
  line-height: 1.12;
  letter-spacing: -1.5px;
}

.home-hero-description {
  max-width: 580px;
  margin: 0 0 18px;
  color: #a5b4cc;
  font-size: 14px;
  line-height: 1.7;
}

/* Mobile adjustments */
@media (max-width: 520px) {
  .home-hero {
    padding: 23px 20px;
    margin-bottom: 20px;
  }

  .home-hero::after {
    width: 150px;
    height: 150px;
    right: -65px;
    top: 50%;
  }

  .home-hero:hover::after {
    animation-duration: 5s;
  }

  .home-eyebrow {
    margin-bottom: 12px;
  }

  .home-hero h1 {
    font-size: clamp(29px, 8vw, 38px);
    letter-spacing: -1px;
  }

  .home-hero-description {
    margin-bottom: 16px;
    font-size: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-hero:hover::after {
    animation: none;
  }
}

        .home-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .home-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          padding: 10px 16px;
          border: 1px solid transparent;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          transition:
            opacity .2s ease,
            transform .2s ease,
            background .2s ease,
            box-shadow .2s ease;
        }

        .home-btn:hover {
          opacity: .9;
          transform: translateY(-2px);
        }

        .home-btn.primary {
          color: #fff;
          background: var(--accent-blue-bright);
          box-shadow: 0 4px 16px rgba(37,99,235,.22);
        }

        .home-btn.primary:hover {
          box-shadow: 0 6px 22px rgba(37,99,235,.38);
        }

        .home-btn.secondary {
          border-color: rgba(148,163,184,.3);
          color: #e2e8f0;
          background: rgba(255,255,255,.035);
        }

        .home-btn.secondary:hover {
          border-color: rgba(34,211,238,.55);
          background: rgba(34,211,238,.08);
        }

        /* SECTION HEADING */

        .home-section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .home-section-heading h2 {
          margin: 0 0 5px;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -.4px;
        }

        .home-section-heading p {
          margin: 0;
          color: var(--text-muted);
          font-size: 12px;
          line-height: 1.6;
        }

        /* ACTION CARDS */

        .home-cards {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
          margin-bottom: 20px;
        }

        .home-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          min-width: 0;
          min-height: 190px;
          padding: 22px;
          border: 1px solid var(--border-color);
          border-radius: 10px;
          background: var(--bg-elevated);
          transition:
            transform .2s ease,
            box-shadow .2s ease,
            border-color .2s ease;
        }

        @media (hover: hover) and (pointer: fine) {
          .home-card:hover {
            transform: translateY(-3px);
            border-color: var(--accent-blue-bright);
            box-shadow: 0 5px 18px rgba(0,0,0,.12);
          }
        }

        .home-card-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border: 1px solid rgba(59,130,246,.2);
          border-radius: 9px;
          background: rgba(37,99,235,.09);
          color: var(--accent-blue-bright);
        }

        .home-card h3 {
          margin: 14px 0 6px;
          font-size: 15px;
          font-weight: 600;
          line-height: 1.4;
        }

        .home-card p {
          flex: 1;
          margin: 0 0 18px;
          color: var(--text-muted);
          font-size: 12px;
          line-height: 1.7;
        }

        .home-card-link {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: var(--accent-blue-bright);
          font-size: 12px;
          font-weight: 600;
          text-decoration: none;
        }

        .home-card-link:hover {
          text-decoration: underline;
        }

        .home-card-link svg {
          transition: transform .2s ease;
        }

        .home-card-link:hover svg {
          transform: translateX(3px);
        }

        .home-btn:focus-visible,
        .home-card-link:focus-visible {
          outline: 2px solid #06d6f5;
          outline-offset: 4px;
        }

        /* TABLET */

        @media (max-width: 900px) {
          .home-page {
            max-width: 100%;
            padding-left: 28px;
            padding-right: 28px;
          }

          .home-cards {
            gap: 14px;
          }

          .home-card {
            padding: 18px;
          }
        }

        @media (max-width: 680px) {
          .home-cards {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .home-card:last-child {
            grid-column: 1 / -1;
          }
        }

        /* MOBILE */

        @media (max-width: 520px) {
          .home-page {
            padding: 12px 16px 24px;
          }

          .home-hero {
            padding: 28px 20px;
            margin-bottom: 24px;
            border-radius: 12px;
          }

          .home-hero::after {
            right: -130px;
            top: 30%;
          }

          .home-eyebrow {
            margin-bottom: 16px;
            font-size: 10px;
          }

          .home-hero h1 {
            font-size: clamp(29px, 8vw, 38px);
            letter-spacing: -1px;
          }

          .home-hero-description {
            font-size: 12px;
            margin-bottom: 20px;
          }

          .home-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .home-btn {
            width: 100%;
            min-height: 42px;
          }

          .home-section-heading h2 {
            font-size: 18px;
          }

          .home-cards {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .home-card,
          .home-card:last-child {
            grid-column: auto;
            min-height: 175px;
            padding: 18px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .home-card,
          .home-btn,
          .home-card-link svg {
            transition: none !important;
          }
        }
      `}</style>

      {/* HERO */}
      <section className="home-hero">
        <div className="home-hero-content">
          <div className="home-eyebrow">
            <Swords size={15} />
            CodeClash Arena
          </div>

          <h1>
            Think. Code.
            <br />
            <span>Conquer the challenge.</span>
          </h1>

          <p className="home-hero-description">
            Create coding battles, challenge developers and put your
            problem-solving skills to the test, all in one place.
          </p>

          <div className="home-actions">
            <Link to="/battle-room/create" className="home-btn primary">
              <PlusCircle size={16} />
              Create a Battle
              <ArrowRight size={15} />
            </Link>

            <Link to="/battle-room" className="home-btn secondary">
              <KeyRound size={15} />
              Join with Key
            </Link>
          </div>
        </div>
      </section>

      {/* MAIN ACTIONS */}
      <section>
        <div className="home-section-heading">
          <div>
            <h2>Get started</h2>
            <p>Choose an action to continue.</p>
          </div>
        </div>

        <div className="home-cards">
          {cards.map(({ icon: Icon, title, text, action, to }) => (
            <article className="home-card" key={title}>
              <div className="home-card-icon">
                <Icon size={20} />
              </div>

              <h3>{title}</h3>
              <p>{text}</p>

              {to.startsWith("mailto:") ? (
                <a href={to} className="home-card-link">
                  {action}
                  <ArrowRight size={13} />
                </a>
              ) : (
                <Link to={to} className="home-card-link">
                  {action}
                  <ArrowRight size={13} />
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
