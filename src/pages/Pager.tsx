import shakeLogo from "@/assets/shake-logo-new.png";
import { Video } from "lucide-react";
import { FaApple, FaAndroid } from "react-icons/fa";

/**
 * Investor one-pager — lives at /pager so it can be updated without
 * re-exporting and re-sharing a PDF. Edit the content below directly;
 * everything on the page is driven from these constants.
 */

// Brand blue used for headings, table header, and callout boxes — Tailwind's
// arbitrary-value classes need this literal inline (a JS constant can't be
// interpolated into a class string at build time), so it's just repeated
// below as `#2563eb`. Change it here in a find-and-replace if it ever needs
// to move.

const PROBLEM_POINTS = [
  "Loneliness & lack of friends",
  "Difficulty finding like-minded people",
  "Social anxiety",
  "Limited opportunities for social interaction",
  "Lack of new experiences",
  "Lack of networking opportunities",
];

const SOLUTION_POINTS = [
  { text: "Weekly lunches, brunches and other plans created by people." },
  { text: "Accept a venue suggestion — meet at the place and time" },
  { text: "Record a short video and propose a plan — friends swipe through and join", bold: true },
  { text: "Browse plans in My City or across All Cities" },
  { text: "Chat, reply to specific messages, and unsend — just like you'd expect" },
];

const PROJECTIONS = [
  { year: "Year 1 · 2026", revenue: "$60,000", expenses: "$10,000", profit: "$50,000" },
  { year: "Year 2 · 2027", revenue: "$240,000", expenses: "$20,000", profit: "$220,000" },
  { year: "Year 3 · 2028", revenue: "$300,000", expenses: "$30,000", profit: "$270,000" },
  { year: "Year 4 · 2029", revenue: "$600,000", expenses: "$90,000", profit: "$510,000" },
  { year: "Year 5 · 2030", revenue: "$900,000", expenses: "$240,000", profit: "$660,000" },
];

const CAP_TABLE = [
  { amount: "$5k", pct: "0.5%" },
  { amount: "$10k", pct: "1%" },
  { amount: "$25k", pct: "2.5%" },
  { amount: "$50k", pct: "5%" },
  { amount: "$100k", pct: "10%" },
];

const TEAM = [
  { name: "Leonel Meneses", role: "Founder & CEO", pct: "100%", linkedin: "https://linkedin.com/in/leonel-meneses-4700152b" },
];

function SectionFooter() {
  return (
    <div className="flex items-center justify-between text-xs text-neutral-400 mt-10 pt-6 border-t border-neutral-200">
      <span>SHAKE — 2026</span>
      <span>shakeapp.today</span>
    </div>
  );
}

export default function Pager() {
  return (
    <div
      className="min-h-[100dvh] bg-[#f5f5fa] text-neutral-900"
      style={{ fontFamily: "Verdana, Geneva, sans-serif" }}
    >
      <div className="max-w-5xl mx-auto px-6 py-12 md:py-16 space-y-16">

        {/* ── Slide 1: Intro ── */}
        <section>
          <img src={shakeLogo} alt="Shake" className="w-14 h-14 mb-4" />
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            A social network for real-life activities.
          </h1>
          <p className="text-neutral-500 mb-10">Connecting everybody online to offline.</p>

          <div className="grid md:grid-cols-[1fr_1fr_auto] gap-10">
            <div>
              <h2 className="text-xs font-semibold tracking-wide text-[#2563eb] mb-4">
                THE PROBLEM
              </h2>
              <ul className="space-y-2 text-neutral-600 list-disc list-inside">
                {PROBLEM_POINTS.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="text-xs font-semibold tracking-wide text-[#2563eb] mb-4">
                THE SOLUTION — WHAT SHAKE DOES TODAY
              </h2>
              <ul className="space-y-2 text-neutral-600 list-disc list-inside">
                {SOLUTION_POINTS.map(({ text, bold }) => (
                  <li key={text} className={bold ? "font-semibold text-neutral-900" : undefined}>
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-[#2563eb] text-white rounded-2xl p-6 md:w-64">
              <h2 className="text-xs font-bold tracking-wide mb-4">LIVE TODAY</h2>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-2">
                  <span aria-hidden>✦</span>
                  <FaApple className="w-4 h-4" aria-label="iOS" />
                  <FaAndroid className="w-4 h-4" aria-label="Android" />
                  <span>apps in market</span>
                </li>
                <li className="flex items-center gap-2">
                  <span aria-hidden>✦</span>
                  <span>Video plan proposals</span>
                  <Video className="w-4 h-4 shrink-0" />
                </li>
                <li className="flex gap-2">
                  <span aria-hidden>✦</span>
                  <span>Make plans just by saying them.</span>
                </li>
                <li className="flex gap-2">
                  <span aria-hidden>✦</span>
                  <span>Plans across multiple cities</span>
                </li>
                <li className="flex gap-2">
                  <span aria-hidden>✦</span>
                  <span>Lisbon + Medellín launch markets with over 10 events done</span>
                </li>
              </ul>
            </div>
          </div>

          <SectionFooter />
        </section>

        {/* ── Slide 2: Business model & projections ── */}
        <section>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-8">
            Business model & projections
          </h1>

          <div className="grid md:grid-cols-[1fr_1.4fr] gap-8">
            <div className="bg-white rounded-2xl p-6 border border-neutral-200">
              <h2 className="text-xs font-semibold tracking-wide text-[#2563eb] mb-3">
                BUSINESS MODEL
              </h2>
              <div className="mb-4">
                <p className="font-semibold">Fees on activities</p>
                <p className="text-neutral-600 text-sm">
                  10% platform fee on paid activities & ticketed events booked through Shake
                </p>
              </div>
              <div className="mb-4">
                <p className="font-semibold">Venue advertising</p>
                <p className="text-neutral-600 text-sm">
                  Paid placements for venues to reach Shakers planning nearby activities
                </p>
              </div>
              <hr className="my-4 border-neutral-200" />
              <div className="mb-4">
                <p className="font-semibold">Traction</p>
                <p className="text-neutral-600 text-sm">
                  Concept already proven: 10+ dinners & brunches hosted in Medellín and Lisbon
                </p>
                <p className="text-neutral-600 text-sm mt-1">
                  Soft-launched V1 Nov 2025 in Lisbon & Medellín — 1,000+ downloads, 3,000 Instagram followers
                </p>
                <p className="text-neutral-600 text-sm mt-1">Soft-launch V2 – Medellín 300 downloads at 07/21</p>
                <p className="text-neutral-600 text-sm mt-1 font-semibold text-neutral-900">
                  V3 is live now — 400 users at the moment
                </p>
              </div>
              <div>
                <p className="font-semibold">Community</p>
                <p className="text-neutral-600 text-sm">
                  Growing network of yoga teachers & community builders ready to host worldwide
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-xs font-semibold tracking-wide text-[#2563eb] mb-3">
                FINANCIAL PROJECTIONS
              </h2>
              <div className="overflow-hidden rounded-2xl border border-neutral-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#2563eb] text-white">
                      <th className="text-left font-semibold px-4 py-3">Year</th>
                      <th className="text-left font-semibold px-4 py-3">Revenue</th>
                      <th className="text-left font-semibold px-4 py-3">Expenses</th>
                      <th className="text-left font-semibold px-4 py-3">Net Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PROJECTIONS.map((row, i) => (
                      <tr key={row.year} className={i % 2 === 1 ? "bg-[#f5f5fa]" : "bg-white"}>
                        <td className="px-4 py-3">{row.year}</td>
                        <td className="px-4 py-3">{row.revenue}</td>
                        <td className="px-4 py-3">{row.expenses}</td>
                        <td className="px-4 py-3 text-emerald-600 font-medium">{row.profit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-[#2563eb] text-white rounded-2xl p-6 mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p>
                    Raising: <span className="font-bold">$50k for marketing initiatives and worldwide launch</span>
                  </p>
                  <p>
                    Public valuation: <span className="font-bold">$3M pre-money</span>
                  </p>
                  <p>
                    Discounted offer: <span className="font-bold">$1M cap for the first $100k invested</span>
                  </p>
                </div>
                <div className="text-sm grid grid-cols-2 gap-x-6 gap-y-1 whitespace-nowrap">
                  {CAP_TABLE.map((row) => (
                    <span key={row.amount}>
                      {row.amount} = {row.pct}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <SectionFooter />
        </section>

        {/* ── Slide 3: Team ── */}
        <section>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-8">Team</h1>
          <div className="space-y-3">
            {TEAM.map((member) => (
              <div
                key={member.name}
                className="bg-white border border-neutral-200 rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#2563eb] text-white flex items-center justify-center font-bold text-sm">
                    {member.pct}
                  </div>
                  <div>
                    <p className="font-semibold">{member.name}</p>
                    <p className="text-neutral-500 text-sm">{member.role}</p>
                  </div>
                </div>
                <a
                  href={member.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#2563eb] text-sm underline"
                >
                  {member.linkedin.replace("https://", "")}
                </a>
              </div>
            ))}
          </div>

          <SectionFooter />
        </section>

        {/* ── Closing ── */}
        <section className="text-center pt-8 pb-4">
          <img src={shakeLogo} alt="Shake" className="w-16 h-16 mx-auto mb-6" />
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Thank you, let's shake!</h1>
          <a href="https://shakeapp.today" className="text-[#2563eb] underline">
            shakeapp.today
          </a>
        </section>
      </div>
    </div>
  );
}
