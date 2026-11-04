import React from "react";
import { Link } from "react-router-dom";
import Reveal from "../../components/experience/Reveal";

// Public landing page.
//
// The headline arrives a word at a time, the mark floats on a 9s loop with a
// ring breathing behind it on an 8s cycle, and everything below the fold fades
// up as it is reached. The restraint is the design: one accent colour, a lot
// of space, nothing flashing.

const c = {
  deep: "#2f6b3a",
  green: "#4b9e4b",
  bright: "#8dc63f",
  ink: "#22312a",
  soft: "#5b6b61",
  line: "rgba(47, 107, 58, 0.12)",
  panel: "rgba(255, 255, 255, 0.72)",
};

const HEADLINE = ["Somewhere", "quiet", "to", "put", "it", "all", "down."];

const FEATURES = [
  {
    title: "Anonymous by default",
    body: "Say what you need to say. Your identity stays yours, and conversations are encrypted where they live.",
  },
  {
    title: "Real people, trained",
    body: "Volunteers who have been through the training, and psychologists who take it from there when it matters.",
  },
  {
    title: "A way onward",
    body: "When something needs more than a conversation, we refer you to NGOs who can actually help.",
  },
];

const STEPS = [
  { n: "01", t: "Say what is going on", d: "One short form. No forms about the form." },
  { n: "02", t: "Someone picks it up", d: "A trained volunteer responds and stays with it." },
  { n: "03", t: "Escalated if it needs to be", d: "A psychologist joins, by message or video call." },
];

const section = { position: "relative", zIndex: 1 };

export default function Home() {
  return (
    <div style={{ ...section, color: c.ink }}>
      {/* ------------------------------------------------------------ hero */}
      <section
        style={{
          minHeight: "min(88vh, 740px)",
          display: "grid",
          placeItems: "center",
          padding: "64px 24px 56px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "820px" }}>
          {/* the mark, floating, with a ring breathing behind it */}
          <div
            style={{
              position: "relative",
              width: "112px",
              height: "112px",
              margin: "0 auto 26px",
              display: "grid",
              placeItems: "center",
            }}
          >
            <span
              className="me-breathe"
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: "-18px",
                borderRadius: "50%",
                border: `1px solid ${c.green}`,
              }}
            />
            <img
              src="/mindease-logo.png"
              alt="MindEase"
              className="me-float"
              width="96"
              height="96"
              style={{ objectFit: "contain" }}
            />
          </div>

          <p
            className="me-word"
            style={{
              animationDelay: "0.1s",
              margin: "0 0 16px",
              fontSize: "0.72rem",
              letterSpacing: "0.34em",
              textTransform: "uppercase",
              color: c.green,
              fontWeight: 600,
            }}
          >
            Mental health support, Bangladesh
          </p>

          {/* headline, one word at a time */}
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(2.1rem, 5.6vw, 3.6rem)",
              lineHeight: 1.08,
              fontWeight: 300,
              letterSpacing: "-0.02em",
              color: c.ink,
            }}
          >
            {HEADLINE.map((word, i) => (
              // a real space between the words, not just a margin: otherwise
              // the headline is one run-on string to a screen reader and to
              // anyone who copies it
              <React.Fragment key={word + i}>
                <span
                  className="me-word"
                  style={{
                    animationDelay: `${0.35 + i * 0.11}s`,
                    // the last word carries the weight
                    fontWeight: i === HEADLINE.length - 1 ? 600 : 300,
                    color: i === HEADLINE.length - 1 ? c.deep : c.ink,
                  }}
                >
                  {word}
                </span>
                {i < HEADLINE.length - 1 ? " " : ""}
              </React.Fragment>
            ))}
          </h1>

          <p
            className="me-word"
            style={{
              animationDelay: "1.35s",
              maxWidth: "540px",
              margin: "22px auto 0",
              fontSize: "1.02rem",
              lineHeight: 1.75,
              color: c.soft,
              fontWeight: 400,
            }}
          >
            MindEase connects you with trained volunteers and certified
            psychologists, anonymously, at your pace, whenever you are ready.
          </p>

          <div
            className="me-word"
            style={{
              animationDelay: "1.6s",
              display: "flex",
              gap: "14px",
              justifyContent: "center",
              flexWrap: "wrap",
              marginTop: "32px",
            }}
          >
            <Link
              to="/register"
              className="me-shine"
              style={{
                display: "inline-block",
                background: `linear-gradient(135deg, ${c.deep}, ${c.green})`,
                color: "#fff",
                padding: "15px 34px",
                borderRadius: "999px",
                fontWeight: 600,
                fontSize: "0.95rem",
                textDecoration: "none",
                boxShadow: "0 12px 30px -12px rgba(47, 107, 58, 0.6)",
              }}
            >
              Start here
            </Link>
            <Link
              to="/login"
              style={{
                display: "inline-block",
                border: `1px solid ${c.line}`,
                background: "rgba(255,255,255,0.6)",
                color: c.ink,
                padding: "15px 34px",
                borderRadius: "999px",
                fontWeight: 600,
                fontSize: "0.95rem",
                textDecoration: "none",
                backdropFilter: "blur(8px)",
              }}
            >
              Log in
            </Link>
          </div>

          <p
            className="me-word"
            style={{
              animationDelay: "1.85s",
              marginTop: "22px",
              fontSize: "0.8rem",
              color: c.soft,
              opacity: 0.85,
            }}
          >
            Free. Anonymous. No one sees your name unless you give it.
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------- features */}
      <section style={{ ...section, padding: "40px 24px 100px" }}>
        <div style={{ maxWidth: "1060px", margin: "0 auto" }}>
          {/* me-pool: the heading and its line sit on the open field, with
              leaves drifting behind them */}
          <div
            className="me-pool"
            style={{ maxWidth: "760px", margin: "0 auto 44px", padding: "30px 26px" }}
          >
          <Reveal>
            <h2
              style={{
                fontSize: "clamp(1.6rem, 3.4vw, 2.3rem)",
                fontWeight: 400,
                letterSpacing: "-0.01em",
                textAlign: "center",
                margin: "0 0 12px",
                color: c.ink,
              }}
            >
              Built around not having to explain yourself twice
            </h2>
          </Reveal>
          <Reveal delay={90}>
            <p
              style={{
                textAlign: "center",
                color: c.soft,
                maxWidth: "520px",
                margin: "0 auto",
                lineHeight: 1.7,
              }}
            >
              Three things we got right before anything else.
            </p>
          </Reveal>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "22px",
            }}
          >
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 130}>
                <article
                  className="me-card"
                  style={{
                    height: "100%",
                    background: c.panel,
                    backdropFilter: "blur(10px)",
                    border: `1px solid ${c.line}`,
                    borderRadius: "18px",
                    padding: "32px 28px",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: "block",
                      width: "34px",
                      height: "2px",
                      borderRadius: "2px",
                      background: `linear-gradient(90deg, ${c.green}, ${c.bright})`,
                      marginBottom: "20px",
                    }}
                  />
                  <h3
                    style={{
                      margin: "0 0 10px",
                      fontSize: "1.12rem",
                      fontWeight: 600,
                      color: c.deep,
                    }}
                  >
                    {f.title}
                  </h3>
                  <p style={{ margin: 0, color: c.soft, lineHeight: 1.72, fontSize: "0.95rem" }}>
                    {f.body}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- steps */}
      <section style={{ ...section, padding: "0 24px 110px" }}>
        {/* me-pool: this block is text straight onto the drifting field, and
            leaves passing through the letters made it hard to read. */}
        <div className="me-pool" style={{ maxWidth: "860px", margin: "0 auto" }}>
          <Reveal>
            <h2
              style={{
                fontSize: "clamp(1.5rem, 3vw, 2rem)",
                fontWeight: 400,
                textAlign: "center",
                margin: "0 0 48px",
                color: c.ink,
              }}
            >
              How it goes
            </h2>
          </Reveal>

          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 120}>
              <div
                style={{
                  display: "flex",
                  gap: "28px",
                  alignItems: "flex-start",
                  padding: "26px 0",
                  borderTop: i === 0 ? "none" : `1px solid ${c.line}`,
                }}
              >
                <span
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    letterSpacing: "0.16em",
                    color: c.bright,
                    paddingTop: "5px",
                    minWidth: "34px",
                  }}
                >
                  {s.n}
                </span>
                <div>
                  <h3 style={{ margin: "0 0 6px", fontSize: "1.1rem", fontWeight: 600, color: c.ink }}>
                    {s.t}
                  </h3>
                  <p style={{ margin: 0, color: c.soft, lineHeight: 1.7, fontSize: "0.95rem" }}>
                    {s.d}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- cta */}
      <section style={{ ...section, padding: "0 24px 120px" }}>
        <Reveal>
          <div
            style={{
              maxWidth: "760px",
              margin: "0 auto",
              textAlign: "center",
              background: "rgba(255,255,255,0.6)",
              backdropFilter: "blur(10px)",
              border: `1px solid ${c.line}`,
              borderRadius: "26px",
              padding: "clamp(40px, 7vw, 72px) 32px",
            }}
          >
            <h2
              style={{
                margin: "0 0 14px",
                fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
                fontWeight: 300,
                color: c.ink,
                lineHeight: 1.25,
              }}
            >
              You do not have to have the words ready.
            </h2>
            <p
              style={{
                margin: "0 auto 34px",
                maxWidth: "440px",
                color: c.soft,
                lineHeight: 1.75,
              }}
            >
              Start with whatever you have. Someone will meet you there.
            </p>
            <Link
              to="/register"
              className="me-shine"
              style={{
                display: "inline-block",
                background: `linear-gradient(135deg, ${c.deep}, ${c.green})`,
                color: "#fff",
                padding: "15px 38px",
                borderRadius: "999px",
                fontWeight: 600,
                textDecoration: "none",
                boxShadow: "0 12px 30px -12px rgba(47, 107, 58, 0.6)",
              }}
            >
              Create an account
            </Link>
            <p style={{ margin: "22px 0 0", fontSize: "0.82rem", color: c.soft }}>
              In crisis right now?{" "}
              <Link to="/resources" style={{ color: c.deep, fontWeight: 600 }}>
                Emergency resources
              </Link>
            </p>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
