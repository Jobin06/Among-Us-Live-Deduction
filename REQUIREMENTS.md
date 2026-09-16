# AMONG US: LIVE DEDUCTION
## Project Requirements Document

This document is the primary source of truth for the functional and non-functional requirements of the application.

The application is an event management, scoring, and live leaderboard system for a physical Among Us e-sports event.

The website is NOT the Among Us game and must NOT attempt to directly integrate with the game.

Any requirement not explicitly defined in this document should be treated as an open design decision. The implementation agent must recommend the simplest robust solution and clearly document that decision before implementation.

Do not remove, weaken, or silently change requirements in this document.

---

# BUILD A COMPLETE FULL-STACK WEBSITE

## AMONG US: LIVE DEDUCTION — E-SPORTS EVENT

You are an expert full-stack software engineer, UI/UX designer, database architect, security engineer, and QA engineer.

Build a COMPLETE, PRODUCTION-READY web application for a university-level physical e-sports event called:

**AMONG US: LIVE DEDUCTION**

Do not create only a frontend prototype or static UI.

Build the complete working application including:

* Frontend
* Backend
* Database
* Authentication
* Role-based authorization
* Participant dashboard
* Volunteer dashboard
* Admin dashboard
* Live leaderboard
* Round management
* Automatic score calculation
* Score history
* Audit logging
* Responsive design
* Validation
* Error handling
* Security
* Seed/demo data
* Setup instructions
* Deployment instructions

The application must be runnable locally and should be structured cleanly enough to deploy to production.

---

# 1. EVENT CONTEXT

This is a face-to-face Among Us e-sports event.

Expected participants:

**30–40 participants**

Event duration:

**9:00 AM – 12:00 PM**

The physical game itself is played through Among Us.

The website is NOT the game.

The website is an:

**EVENT MANAGEMENT + SCORING + LIVE LEADERBOARD SYSTEM**

Participants should use the website to:

* Login
* View event information
* View schedule
* View rules
* View their assigned lobby
* View their own scores
* View the live leaderboard
* View their qualification/final status

Participants must NOT be able to modify scores.

Volunteers should use the website to:

* Login
* View assigned rounds/lobbies
* Enter participant performance
* Automatically calculate scores
* Save scores
* Update the leaderboard
* Correct scores when authorized
* View score history
* Monitor the event

Admins should be able to control the complete system.

---

# 2. EVENT STRUCTURE

Use the following recommended event structure.

## Registration

9:00 AM – 9:15 AM

## Briefing

9:15 AM – 9:30 AM

## Practice Round

9:30 AM – 9:45 AM

The practice round DOES NOT contribute to leaderboard scores.

## Preliminary Round 1

9:45 AM – 10:05 AM

## Preliminary Round 2

10:10 AM – 10:30 AM

## Preliminary Round 3

10:35 AM – 10:55 AM

## Preliminary Results

10:55 AM – 11:05 AM

## Final

11:05 AM – 11:40 AM

## Final Results

11:40 AM – 11:50 AM

## Buffer / Prize Distribution

11:50 AM – 12:00 PM

The system must allow administrators to change these timings.

---

# 3. LOBBY STRUCTURE

For approximately 30–40 participants:

Use multiple preliminary lobbies.

Example:

30 participants:

* Lobby A
* Lobby B
* Lobby C
* Lobby D

40 participants:

* Lobby A
* Lobby B
* Lobby C
* Lobby D

The exact number of participants per lobby should be configurable.

Admins must be able to:

* Create lobbies
* Rename lobbies
* Assign participants
* Move participants between lobbies
* View lobby members
* View lobby status

During the final, qualified participants should be able to be assigned to one final lobby.

Do NOT hard-code the number of participants or lobbies.

---

# 4. USER ROLES

Implement three roles.

## PARTICIPANT

Read-only access to event information and scores.

Participants cannot modify:

* Scores
* Rankings
* Round status
* Lobby assignments
* Other participants
* Event configuration

## VOLUNTEER

Can:

* View event rounds
* View assigned participants/lobbies
* Enter scores
* Edit scores where permitted
* Save scores
* View leaderboard
* View score history

Volunteers must NOT be able to:

* Delete the database
* Create administrator accounts
* Change system settings
* Modify participant authentication credentials
* Change core scoring rules unless explicitly authorized

## ADMIN

Full access.

Admin can:

* Create/edit/delete participants
* Create/edit volunteers
* Manage accounts
* Create rounds
* Configure scoring
* Manage lobbies
* Assign participants
* Start/end rounds
* Enter/edit scores
* Lock scores
* Unlock scores
* Publish results
* Manage qualification
* Manage final round
* View audit logs
* Reset event data
* Export scores
* View system statistics

---

# 5. AUTHENTICATION

Implement secure authentication.

Login should support:

Participant:

* Participant ID
* Password

Volunteer/Admin:

* Username or ID
* Password

Passwords must NEVER be stored as plaintext.

Use secure password hashing.

Implement:

* Login
* Logout
* Session/token management
* Protected routes
* Role-based authorization
* Invalid login handling
* Session expiration
* Password change functionality for admin-managed accounts

Participants should only be able to access their own private information.

A participant must never be able to access another participant's private dashboard by changing an ID in the URL.

---

# 6. PARTICIPANT DASHBOARD

Create a clean modern dashboard.

Header:

**AMONG US: LIVE DEDUCTION**

Display:

* Participant name
* Participant ID
* Among Us username
* Assigned lobby
* Current round
* Current status

Example:

Participant:

P024

Lobby:

B

Status:

PRELIMINARY ROUND 2

---

# 7. PARTICIPANT PAGES

Create the following pages.

## Dashboard

Show:

* Current event status
* Current round
* Lobby
* Current score
* Current rank
* Qualification status
* Important announcements

## Event Information

Show:

* Event name
* Event description
* Event date
* Event duration
* Venue information
* Event objective

## Schedule

Display the complete event schedule.

## Rules

Show:

### General Rules

* Participants must use their own device/game account.
* No cheats, hacks, mods or unauthorized software.
* Players must not access another participant's device.
* Players must not communicate with eliminated/dead players unless permitted.
* Abusive, offensive or disruptive behavior can result in disqualification.

### Communication Rules

During normal gameplay:

* No communication between players.

During an Emergency Meeting or Body Report:

* Physical verbal communication is allowed.

Players may:

* Explain where they were
* Tell others what they observed
* Question players
* Accuse suspicious players
* Defend themselves
* Discuss possible Imposters

Players may NOT:

* Privately message other participants
* Whisper secretly
* Communicate with dead/eliminated players
* Receive information from spectators
* Use WhatsApp, Discord or other external communication applications.

### Meeting Rules

When a body is reported or an emergency meeting occurs:

* Discussion begins
* Eligible players participate
* Fixed discussion time is provided
* Players present evidence
* Players make accusations
* Players should avoid shouting
* Voting begins after discussion
* Players cast their own votes
* Players should not reveal roles unless allowed by event rules

### Imposter Rules

Imposters must:

* Eliminate Crewmates according to game rules
* Avoid identification
* Use deception and strategy
* Participate in discussions without revealing identity

Imposters must not coordinate using external communication.

### Crewmate Rules

Crewmates must:

* Complete assigned tasks
* Observe player movements
* Report bodies
* Participate in discussions
* Identify suspicious behavior
* Vote strategically

---

# 8. SCORING SYSTEM

Implement configurable scoring.

Initial scoring values:

| Performance                                     | Points |
| ----------------------------------------------- | -----: |
| Correctly vote out an Imposter                  |     +3 |
| Correctly identify an Imposter                  |     +1 |
| Complete a task                                 |     +1 |
| Survive the round                               |     +2 |
| Win as a Crewmate                               |     +3 |
| Win as an Imposter                              |     +5 |
| Successful elimination as Imposter              |     +2 |
| Successfully avoid being identified as Imposter |     +3 |
| Voted out as Imposter                           |     -2 |

IMPORTANT:

Do NOT allow volunteers to simply type a final score.

Instead, create a performance-based scoring form.

Example:

Participant: P024

Role:

[ Crewmate / Imposter ]

Correctly voted out an Imposter:

[ checkbox ]

Correctly identified an Imposter:

[ checkbox ]

Tasks completed:

[ number ]

Survived:

[ checkbox ]

Won as Crewmate:

[ checkbox ]

Won as Imposter:

[ checkbox ]

Successful elimination:

[ checkbox ]

Successfully avoided identification:

[ checkbox ]

Voted out as Imposter:

[ checkbox ]

Then automatically calculate:

TOTAL ROUND SCORE

The scoring rules should be stored in the database/configuration and not scattered throughout frontend code.

---

# 9. SCORE CALCULATION

Example:

Participant P024:

* Correct vote: +3
* Correct identification: +1
* 3 tasks: +3
* Survived: +2
* Won as Crewmate: +3

Total:

12 points.

The UI should show the calculation before saving.

Example:

CORRECT VOTE +3
IDENTIFICATION +1
TASKS +3
SURVIVAL +2
WIN +3

TOTAL = 12

Volunteer must click:

[ VERIFY & SAVE SCORE ]

---

# 10. SCORE VALIDATION

Prevent impossible combinations.

For example:

If role = CREWMATE:

* Imposter-specific fields should be disabled.

If role = IMPOSTER:

* Crewmate-specific win field should be disabled.

If "Voted out as Imposter" is selected:

* "Survived" should not be selectable.

Prevent negative task numbers.

Validate all numeric inputs.

Show confirmation before saving.

---

# 11. ROUND MANAGEMENT

Rounds should be database entities.

Round types:

* Practice
* Preliminary
* Final

Each round should have:

* ID
* Name
* Number
* Type
* Status
* Start time
* End time
* Lobby
* Score lock state

Statuses:

* UPCOMING
* ACTIVE
* SCORING
* COMPLETED
* LOCKED

Practice round must not affect rankings.

---

# 12. VOLUNTEER DASHBOARD

Create a separate interface.

Dashboard should show:

* Current round
* Active lobbies
* Participants
* Score entry status
* Completed score entries
* Pending score entries
* Current leaderboard

Example:

ROUND 1

Lobby A

| Participant | Score Status |
| ----------- | ------------ |
| P001        | Completed    |
| P002        | Pending      |
| P003        | Completed    |

Allow volunteer to click:

[ ENTER SCORE ]

---

# 13. SCORE ENTRY PAGE

Volunteer selects:

Round

Lobby

Participant

Then enters performance.

After calculation show:

ROUND SCORE:

12

Previous total:

18

New total:

30

Buttons:

[ SAVE ]

[ CANCEL ]

Before saving:

Show confirmation.

---

# 14. SCORE EDITING

Scores should NOT be permanently overwritten without trace.

If an authorized user changes:

P024 Round 1:

12 → 10

store:

* Previous value
* New value
* User who changed it
* Timestamp
* Reason for change

Create an audit log.

---

# 15. LEADERBOARD

Create a live leaderboard.

Columns:

| Rank | Participant | Score | Status |
| ---- | ----------- | ----: | ------ |

Sort by:

Total score descending.

Show:

* Rank
* Participant ID/name
* Total score
* Qualification status

Do NOT expose private information.

Participants should see the public leaderboard but not private account details.

---

# 16. PERSONAL SCORE PAGE

Participant should see:

MY SCORE

Round 1: 12
Round 2: 10
Round 3: 15

TOTAL: 37

CURRENT RANK: #4

Also display a breakdown of each round.

Example:

Round 1

Correct vote: +3
Identification: +1
Tasks: +3
Survival: +2
Win: +3

Total: 12

---

# 17. QUALIFICATION SYSTEM

After preliminary rounds:

Calculate total scores.

Allow admin to specify:

QUALIFICATION COUNT = 8

The system automatically selects the top 8.

Display:

QUALIFIED FOR FINAL

1. P024
2. P017
3. P031
   ...

Everyone else:

NOT QUALIFIED

Qualification should be based on cumulative preliminary scores.

If two participants have equal scores around the qualification cutoff, provide an admin-configurable tie-break mechanism rather than silently making an arbitrary decision.

---

# 18. FINAL ROUND

Admin can create final rounds.

Example:

Final Round 1
Final Round 2
Final Round 3

Only qualified participants should appear in the final score-entry interface.

Calculate final scores separately.

Display:

PRELIMINARY SCORE
+
FINAL SCORE
===========

OVERALL SCORE

Make the exact ranking calculation configurable.

Do NOT assume a final scoring formula if it has not been explicitly configured by the admin.

---

# 19. RESULTS

Admin must have a:

[ PUBLISH FINAL RESULTS ]

button.

Before publishing:

Show confirmation.

After publishing:

Participants see:

FINAL RESULTS

🥇 1st
🥈 2nd
🥉 3rd

Also show the complete ranking.

Once published, results should be locked unless an administrator explicitly unlocks them.

---

# 20. PROJECTOR / PUBLIC LEADERBOARD MODE

Create a special presentation page.

Example route:

/leaderboard

The page should be optimized for a projector.

Features:

* Large typography
* High contrast
* Minimal UI
* Large rankings
* Current round
* Event status
* Automatic refresh
* Optional full-screen mode

Example:

AMONG US: LIVE DEDUCTION

LIVE LEADERBOARD

1   P024     37
2   P017     35
3   P031     33
4   P018     32
5   P006     31

The leaderboard should update automatically after scores are saved.

---

# 21. ANNOUNCEMENTS

Admin should be able to create announcements.

Examples:

"Round 2 is starting."

"Scores are being calculated."

"Top 8 participants have qualified for the final."

Participants should see active announcements on their dashboard.

---

# 22. EVENT STATE

Implement global event state:

* NOT_STARTED
* REGISTRATION
* BRIEFING
* PRACTICE
* PRELIMINARY
* RESULTS
* FINAL
* COMPLETED

The admin can change the current event state.

Participant dashboard should reflect the current state.

---

# 23. DATABASE

Use a relational database.

Recommended entities:

users

participants

volunteers

lobbies

rounds

round_participants

score_entries

scoring_rules

qualifications

announcements

audit_logs

event_settings

Use proper foreign keys and indexes.

Do not duplicate information unnecessarily.

---

# 24. SUGGESTED DATABASE STRUCTURE

users:

* id
* username
* password_hash
* role
* created_at
* updated_at

participants:

* id
* user_id
* participant_id
* name
* among_us_username
* lobby_id
* status
* created_at

lobbies:

* id
* name
* type
* capacity
* status

rounds:

* id
* name
* round_number
* type
* status
* starts_at
* ends_at
* score_locked

round_participants:

* id
* round_id
* participant_id
* lobby_id

score_entries:

* id
* round_id
* participant_id
* role
* correct_vote
* correct_identification
* tasks_completed
* survived
* won_as_crewmate
* won_as_imposter
* successful_elimination
* avoided_identification
* voted_out_as_imposter
* total_score
* entered_by
* created_at
* updated_at

scoring_rules:

* id
* rule_name
* points
* active

qualifications:

* id
* participant_id
* preliminary_score
* qualified
* rank

announcements:

* id
* title
* message
* active
* created_by
* created_at

audit_logs:

* id
* user_id
* action
* entity_type
* entity_id
* old_value
* new_value
* reason
* created_at

event_settings:

* id
* event_name
* event_status
* qualification_count
* event_start
* event_end

---

# 25. SECURITY

Implement proper authorization.

Critical requirement:

A PARTICIPANT must NEVER be able to:

* Modify score
* Modify lobby
* Modify another participant
* Access volunteer routes
* Access admin routes
* Modify URL parameters to access another participant's private data

Protect backend APIs, not just frontend pages.

Validate authorization on the server.

Use:

* Password hashing
* Secure sessions/tokens
* Input validation
* Server-side authorization
* SQL injection protection
* XSS protection
* CSRF protection where applicable
* Rate limiting for login
* Secure error handling

Never expose passwords.

Never return password hashes through APIs.

---

# 26. UI/UX

Design should look like a polished university e-sports event platform.

Style:

* Modern
* Professional
* Dark gaming-inspired interface
* Clean cards
* Clear typography
* Strong leaderboard hierarchy
* Responsive
* Minimal unnecessary animation

Do not make it look like a generic corporate dashboard.

Use subtle Among Us-inspired visual language, but do not copy copyrighted game UI assets.

Use text/CSS/iconography instead of relying on copyrighted assets.

---

# 27. RESPONSIVE DESIGN

The participant portal must work on:

* Desktop
* Laptop
* Tablet
* Mobile phone

Volunteer dashboard should work especially well on laptops/tablets.

Projector leaderboard should prioritize large desktop/projector screens.

---

# 28. ERROR STATES

Implement meaningful errors.

Examples:

"Invalid participant ID or password."

"This score has already been locked."

"You do not have permission to modify this score."

"Round 1 is not currently accepting scores."

"Participant is not assigned to this round."

"Unable to save score. Please try again."

---

# 29. LOADING STATES

Use proper loading indicators.

Never leave the user wondering whether an action worked.

After saving a score:

Show:

✓ Score saved successfully.

Then refresh:

* Participant total
* Leaderboard
* Rank

---

# 30. AUDIT LOG

Every important administrative action should be recorded.

Examples:

ADMIN CREATED PARTICIPANT

VOLUNTEER ENTERED SCORE

VOLUNTEER UPDATED SCORE

ADMIN LOCKED ROUND

ADMIN UNLOCKED SCORE

ADMIN PUBLISHED RESULTS

Record:

* User
* Action
* Time
* Entity
* Previous value
* New value
* Reason when applicable

---

# 31. DATA EXPORT

Admin should be able to export:

* Participant list
* Round scores
* Final leaderboard
* Complete score history

Provide CSV export.

If practical, provide Excel export as well.

---

# 32. DASHBOARD STATISTICS

Admin dashboard should display:

Total Participants

30–40

Active Round

Preliminary Round 2

Participants Scored

28 / 40

Current Leader

P024

Qualified

8 / 8

Pending Scores

12

---

# 33. ADMIN EVENT CONTROL

Provide controls:

[ Start Registration ]

[ Start Practice ]

[ Start Preliminary Round ]

[ Open Scoring ]

[ Lock Scores ]

[ Publish Preliminary Results ]

[ Start Final ]

[ Publish Final Results ]

Use confirmation dialogs for destructive or irreversible operations.

---

# 34. DEMO DATA

Create seed/demo data.

Include:

* 40 participants
* 4 lobbies
* 3 preliminary rounds
* 8 finalists
* 3 final rounds
* 3 volunteers
* 1 admin

Create demo accounts and clearly document their credentials.

Do not hard-code credentials into production logic.

---

# 35. TESTING

Before declaring the application complete, test:

Authentication

Participant login

Volunteer login

Admin login

Role authorization

Participant cannot access volunteer routes

Participant cannot access admin routes

Volunteer cannot access admin-only operations

Score calculation

Score editing

Score locking

Leaderboard sorting

Qualification

Tie handling

Final scoring

Result publishing

CSV export

Audit logging

Mobile responsiveness

Invalid inputs

Session expiry

Database errors

---

# 36. IMPORTANT FUNCTIONAL REQUIREMENT

The website must NOT manually calculate leaderboard positions.

The backend/database must calculate:

Round Score

*

Cumulative Score

*

Rank

*

Qualification

automatically.

The frontend only displays the results.

---

# 37. IMPORTANT SCORING REQUIREMENT

Do not allow a volunteer to directly type:

"Total Score = 37"

The volunteer enters the underlying performance.

The application calculates the score.

This prevents calculation mistakes.

---

# 38. REAL-TIME / NEAR REAL-TIME LEADERBOARD

Implement automatic leaderboard updates.

Preferred:

WebSocket / Server-Sent Events / equivalent real-time mechanism.

If that introduces unnecessary complexity, implement reliable polling with a short interval.

After a volunteer saves a score:

Participant leaderboard should update automatically.

Projector leaderboard should update automatically.

---

# 39. NO GAME INTEGRATION

Do NOT attempt to directly integrate with Among Us.

The physical Among Us game remains separate.

The website receives performance information from volunteers.

Architecture:

AMONG US GAME

↓

Physical gameplay

↓

Volunteer observes/results

↓

Website score-entry system

↓

Automatic score calculation

↓

Database

↓

Leaderboard

---

# 40. PROJECT STRUCTURE

Use a clean professional project structure.

Separate:

* Frontend
* Backend
* Database
* Authentication
* Components
* Services
* API
* Models
* Validation
* Configuration
* Tests

Do not place the entire application in one or two giant files.

Use reusable components.

---

# 41. ENVIRONMENT VARIABLES

Use environment variables for:

* Database URL
* Authentication secret
* API configuration
* Production configuration

Create:

.env.example

Never commit real secrets.

---

# 42. DOCUMENTATION

Create a comprehensive README containing:

1. Project overview
2. Features
3. Technology stack
4. Architecture
5. Database setup
6. Environment variables
7. Installation
8. Running locally
9. Creating database
10. Seeding demo data
11. Demo credentials
12. Production deployment
13. How participants use the system
14. How volunteers use the system
15. How administrators use the system
16. Troubleshooting

---

# 43. DEVELOPMENT APPROACH

Do NOT stop after generating the UI.

Work through the project in phases:

PHASE 1
Analyze requirements.

PHASE 2
Design architecture.

PHASE 3
Create database schema.

PHASE 4
Implement backend.

PHASE 5
Implement authentication and authorization.

PHASE 6
Implement participant interface.

PHASE 7
Implement volunteer scoring interface.

PHASE 8
Implement admin interface.

PHASE 9
Implement leaderboard.

PHASE 10
Implement qualification/final system.

PHASE 11
Implement audit logs and exports.

PHASE 12
Implement responsive design.

PHASE 13
Test the entire system.

PHASE 14
Fix all discovered issues.

PHASE 15
Provide final setup/deployment instructions.

Do not claim the project is complete if only the frontend has been created.

---

# 44. FINAL ACCEPTANCE CRITERIA

Consider the application complete only when:

1. A participant can log in.
2. A participant can see their dashboard.
3. A participant can see event information.
4. A participant can see rules.
5. A participant can see their lobby.
6. A participant can see their score.
7. A participant can see the leaderboard.
8. A participant cannot edit scores.
9. A volunteer can log in.
10. A volunteer can select a round.
11. A volunteer can select a participant.
12. A volunteer can enter performance data.
13. The system automatically calculates the score.
14. The score can be saved.
15. The cumulative score updates.
16. The leaderboard updates.
17. Rank updates automatically.
18. Practice scores do not affect rankings.
19. Preliminary qualification works.
20. Top 8 can qualify.
21. Final rounds can be created.
22. Final scores can be entered.
23. Final rankings can be calculated.
24. Admin can publish results.
25. Published results can be locked.
26. Score modifications create audit logs.
27. CSV export works.
28. Role-based authorization works.
29. Invalid access attempts are blocked.
30. The application works on mobile and desktop.
31. Projector leaderboard works.
32. The project can be installed and run from the provided README.

---

# 45. MOST IMPORTANT INSTRUCTION

Build the actual working application.

Do not give me only:

* UI mockups
* Static HTML
* Fake buttons
* Fake database responses
* Hard-coded leaderboard data
* Placeholder authentication

Every major button should perform a real operation.

Every major piece of data should come from the database.

Every score should be calculated by actual application logic.

Every protected operation should be authorized on the backend.

If you encounter a design decision that has not been explicitly specified, choose the simplest robust implementation and document the decision rather than stopping the development process.

At the end, provide:

1. Complete project structure
2. Technology stack
3. Database schema
4. How to install
5. How to run
6. Demo credentials
7. How to deploy
8. List of implemented features
9. List of assumptions/design decisions
10. Testing results

Build the system end-to-end.
