import { Link } from "react-router-dom";

/** The gathering places that already exist. pwsh.ca points at them; it does
 *  not try to replace any of them.
 *
 *  A place usually has one destination, and then the whole card is the link.
 *  `links` is for the case where one heading honestly covers several — the
 *  conferences are siblings, not rivals, and giving each its own card would
 *  imply a choice nobody has to make. */
type Place = {
  name: string;
  what: string;
  href?: string;
  links?: { name: string; href: string }[];
};

const PLACES: Place[] = [
  {
    name: "PowerShell on GitHub",
    href: "https://github.com/PowerShell/PowerShell",
    what: "The shell itself: source, issues, RFCs, and every release since 6.0.",
  },
  {
    name: "PowerShell Discord",
    href: "https://aka.ms/psdiscord",
    what: "Where questions get answered in minutes instead of days.",
  },
  {
    name: "PowerShell Gallery",
    href: "https://www.powershellgallery.com/",
    what: "Modules and scripts the community publishes for everyone else.",
  },
  {
    name: "The docs",
    href: "https://learn.microsoft.com/powershell/",
    what: "Reference, about_ topics, and the learning path, all open source too.",
  },
  {
    name: "r/PowerShell",
    href: "https://www.reddit.com/r/PowerShell/",
    what: "Long-form problems, war stories, and the weekly script showcase.",
  },
  {
    name: "The conferences",
    what: "Two of them, both in person, both worth the flight: PSConf EU each June in Wiesbaden, and PowerShell Summit each April in North America.",
    links: [
      { name: "PSConf EU", href: "https://psconf.eu/" },
      { name: "PowerShell Summit", href: "https://www.powershellsummit.org/" },
    ],
  },
];

/** What this domain is for once it grows past a placeholder. */
const PLANS: { title: string; body: string }[] = [
  {
    title: "A curated map",
    body: "One page that answers “where do I go for X?” without a search engine in the middle.",
  },
  {
    title: "Short links",
    body: "pwsh.ca/<something> for the links the community passes around: docs pages, gists, session slides.",
  },
  {
    title: "Community projects",
    body: "A shelf for open-source modules and tools worth knowing about, with credit to the people who built them.",
  },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">PowerShell Community site · v0</p>
          <h1>
            A home for the open-source
            <br />
            PowerShell community.
          </h1>
          <p className="lede">
            <strong>pwsh.ca</strong> is a small, community-run corner of the
            internet for the people who live in the shell. There is not much
            here yet — a landing pad, a short-link service, and a plan. The
            rest is being written.
          </p>
          <p className="hero-actions">
            <a
              className="button button-primary"
              href="https://github.com/adilio/pwsh.ca"
              target="_blank"
              rel="noreferrer"
            >
              Follow along on GitHub
            </a>
            <a className="button button-ghost" href="#places">
              Where the community is
            </a>
          </p>
        </div>

        {/* A console, not a screenshot of one: real text, selectable, and it
            reflows on a phone instead of scrolling sideways. */}
        <div className="console" aria-hidden="true">
          <div className="console-bar">
            <span className="console-dot" />
            <span className="console-dot" />
            <span className="console-dot" />
            <span className="console-title">pwsh</span>
          </div>
          <pre className="console-body">
            <code>
              <span className="c-prompt">PS pwsh.ca&gt;</span>{" "}
              <span className="c-cmd">Get-Community</span>{" "}
              <span className="c-param">-Name</span>{" "}
              <span className="c-str">PowerShell</span>
              {"\n\n"}
              <span className="c-key">Name    </span> : PowerShell
              {"\n"}
              <span className="c-key">License </span> : MIT
              {"\n"}
              <span className="c-key">Runs on </span> : Windows, macOS, Linux
              {"\n"}
              <span className="c-key">Members </span> : you, mostly
              {"\n"}
              <span className="c-key">Status  </span> :{" "}
              <span className="c-ok">Open</span>
              {"\n\n"}
              <span className="c-prompt">PS pwsh.ca&gt;</span>{" "}
              <span className="c-caret">▊</span>
            </code>
          </pre>
        </div>
      </section>

      <section className="places" id="places">
        <header className="section-head">
          <h2>Where the community already is</h2>
          <p>
            The good stuff predates this domain by years. Start in these rooms.
          </p>
        </header>
        <ul className="place-grid">
          {PLACES.map((place) => (
            <li key={place.name}>
              {place.href ? (
                <a
                  className="place-card"
                  href={place.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  <h3>
                    {place.name}
                    <span className="place-arrow" aria-hidden="true">
                      ↗
                    </span>
                  </h3>
                  <p>{place.what}</p>
                </a>
              ) : (
                /* Several destinations, so the card itself is not clickable —
                   a whole-card hover would promise a single target it does
                   not have. The links carry their own affordance. */
                <div className="place-card place-card-multi">
                  <h3>{place.name}</h3>
                  <p>{place.what}</p>
                  <p className="place-links">
                    {place.links?.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {link.name}
                        <span aria-hidden="true"> ↗</span>
                      </a>
                    ))}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="plans">
        <header className="section-head">
          <h2>What lands here next</h2>
          <p>Roughly in this order, as time allows.</p>
        </header>
        <ol className="plan-list">
          {PLANS.map((plan, i) => (
            <li key={plan.title}>
              <span className="plan-index" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{plan.title}</h3>
                <p>{plan.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="shortener-note">
        <h2>The short links work today</h2>
        <p>
          Every <code>pwsh.ca/&lt;code&gt;</code> is a redirect kept in this
          site's own store. Creating them needs the admin token; following them
          needs nothing at all.
        </p>
        <p>
          <Link className="button button-ghost" to="/admin">
            Open the admin portal
          </Link>
        </p>
      </section>
    </>
  );
}
