"use client";

import React, { useState } from "react";
import { BookOpen, Shield, MessageSquare, Users, Skull, ChevronDown, ChevronUp } from "lucide-react";

interface RuleSection {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  accent: string;
  items: string[];
}

export default function RulesPage() {
  const sections: RuleSection[] = [
    {
      id: "general",
      title: "1. General Rules",
      subtitle: "Hardware policies, fair play, and sportsmanship",
      icon: Shield,
      accent: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
      items: [
        "Participants must use their own device/game account.",
        "No cheats, hacks, mods, or unauthorized software of any kind.",
        "Players must never touch or access another participant's device.",
        "Players must not communicate with eliminated/dead players unless permitted by tournament rules.",
        "Abusive, offensive, or disruptive behavior will result in immediate disqualification.",
      ],
    },
    {
      id: "communication",
      title: "2. Communication Rules",
      subtitle: "Silence during rounds, physical discussion during meetings",
      icon: MessageSquare,
      accent: "text-amber-400 border-amber-500/30 bg-amber-500/10",
      items: [
        "During normal gameplay: STRICT SILENCE. No communication of any kind between players.",
        "During Emergency Meetings or Body Reports: Physical verbal communication is permitted in the designated meeting area.",
        "Permitted speech: Explain locations, report observations, question suspicious behavior, accuse, defend, and strategize.",
        "Prohibited: Private messaging, whispering secretly, communicating with spectators or eliminated players.",
        "Prohibited: Utilizing Discord, WhatsApp, SMS, or any external communication applications during matches.",
      ],
    },
    {
      id: "meetings",
      title: "3. Meeting & Voting Rules",
      subtitle: "Discussion protocol, evidence presentation, and voting",
      icon: Users,
      accent: "text-purple-400 border-purple-500/30 bg-purple-500/10",
      items: [
        "When a body is reported or emergency button pressed, all alive players report to the meeting zone.",
        "Fixed discussion timer begins; evidence is presented concisely and accusations are debated.",
        "Avoid shouting or talking over referees and participants.",
        "Voting begins after discussion: each alive player casts their vote independently on their own device.",
        "Players should not reveal private in-game roles unless permitted by round parameters.",
      ],
    },
    {
      id: "imposter",
      title: "4. Imposter Rules",
      subtitle: "Eliminations, deception, and identity preservation",
      icon: Skull,
      accent: "text-red-400 border-red-500/30 bg-red-500/10",
      items: [
        "Eliminate Crewmates strictly according to in-game cooldown mechanics.",
        "Successfully avoid identification by formulating alibis and participating actively in discussions.",
        "Use strategic deception without breaking physical meeting communication boundaries.",
        "Imposters must never coordinate with co-imposters using unauthorized external communication.",
        "Voted out imposters receive a -2 penalty deduction on that round's score.",
      ],
    },
    {
      id: "crewmate",
      title: "5. Crewmate Rules",
      subtitle: "Task completion, observation, and strategic voting",
      icon: Users,
      accent: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
      items: [
        "Complete all assigned tasks (+1 point per completed task) to contribute to team win condition.",
        "Observe player movements, monitor camera/admin stations, and promptly report dead bodies.",
        "Participate constructively in emergency meetings by providing truthful location and task evidence.",
        "Identify suspicious behavior and vote strategically to eliminate Imposters (+3 points for correct vote).",
        "Survive through the round (+2 points) to maximize preliminary standing.",
      ],
    },
  ];

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    general: true,
    communication: true,
    meetings: true,
    imposter: true,
    crewmate: true,
  });

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <main className="container mx-auto p-4 sm:p-6 max-w-4xl space-y-8">
      {/* Title */}
      <div className="border-b border-border pb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">
          <BookOpen className="h-3.5 w-3.5" /> Rulebook
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100">
          Official Tournament Rules
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Standard code of conduct and game mechanics for physical live deduction play
        </p>
      </div>

      {/* Accordion / Cards */}
      <div className="space-y-4">
        {sections.map((section) => {
          const Icon = section.icon;
          const isOpen = openSections[section.id];
          return (
            <div
              key={section.id}
              className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm transition"
            >
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-3">
                  <div className={"flex h-10 w-10 items-center justify-center rounded-xl border " + section.accent}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-100">
                      {section.title}
                    </h2>
                    <p className="text-xs text-muted-foreground">{section.subtitle}</p>
                  </div>
                </div>
                <div className="text-muted-foreground">
                  {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-2 border-t border-border/60">
                  <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-cyan-400">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
