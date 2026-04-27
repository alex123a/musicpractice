# Problem Solving Loop (Loop B) - App Development Documentation

## Overview
The Problem Solving Loop is triggered when a user indicates that issues were detected during practice. It provides a systematic approach to diagnosing and solving technical problems through isolation, identification, and targeted strategy application.

---

## Initial Context Note

**User Message on "Choose Your Focus" Screen:**
"Choose the focus for now. No worries—you can change your focus later if you notice something different than what you were originally focusing on."

---

## Section B1: Issue Persistence Check

### Screen B1
**Title:** Play the Passage - Check for Persistence

**Instruction to User:**
"Play the whole passage around the problem a few more times. Does the issue persist?"

**User Options:**
- Record the performance (optional)
- Play without recording and continue

**Navigation Based on Response:**

#### If User Selects "No" → Screen B1-2
#### If User Selects "Yes" → Screen B1-3

---

### Screen B1-2: No Issue Detected

**Title:** Issue Resolution Confirmed

**Message to User:**
"Great! The issue appears to have resolved itself. What would you like to do next?"

**User Options:**

1. **"No Problem - Practice Next Passage"**
   - Action: Restart from the very beginning of the practice loop
   - Navigation: Loop restarts (return to focus selection screen)

2. **"Stability Issue - I Want to Practice This More"**
   - Message: "You want to build more stability with this passage. Let's practice it a few more times with focused strategies."
   - Action: Extra stability loop begins
   - Navigation: Leads to stability-focused practice loop (future development)
   - Admin Note: Stability loop strategies need to be developed

---

### Screen B1-3: Issue Persists

**Title:** Understanding the Problem

**Message to User:**
"The issue persists. Let's identify exactly what's happening so we can solve it systematically."

**Message to User (Explanation):**
"We'll now isolate the problematic section, identify what's going wrong, and then work through targeted strategies to fix it."

**Navigation:** Proceed to Section B2

---

## Section B2: Problem Isolation & Identification

### General Features for All B2 Screens

- **Skip Step Button** (upper right corner): Available on all screens except when marked as "100% necessary"
- **Skip Function:** Skips to the next screen in the sequence
- **Recording Option:** Available on screens B2-1 and B2-2 (side panel)
- **Archive Feature:** All identified problems are stored in a session archive for later review

---

### Screen B2-1: Isolate the Problem

**Title:** Find the Exact Problem Location

**Instruction to User:**
"Where exactly is the problem? Try to find just the problematic excerpt—it could be a few notes or a few bars. Play just that section."

**Features:**
- Optional recording capability (side panel)
- Playback of recorded performance
- Clear visual indicator of the isolated section

**Navigation:** Proceed to Screen B2-2

**Admin Note:** Users often struggle with this step. Consider adding a visual aid or guideline for "how short is too short" (suggest 2-4 bars as a starting point).

---

### Screen B2-2: Identify the Problem

**Title:** Define the Exact Issue

**Instruction to User:**
"What exactly is the problem? If you're not sure, listen to your recording. You can also try to exaggerate the error to make sure you understand what the issue is."

**Features:**
- Playback of the isolated recording
- Text input field to describe the problem
- Option to exaggerate the error in real-time

**Problem Categories (Admin Reference):**
Provide examples for each category:
- Intonation issues (sharp, flat, inconsistent pitch)
- Rhythm problems (timing, rushing, dragging)
- Articulation issues (unclear attack, poor release)
- Bow control (scratchy, uneven tone)
- Coordination (hand synchronization)

**Submission Function:**
- "Write down what exactly is the issue" text field
- Record the problem description
- Store in practice session archive for later teacher review

**Difficulty Option:**
Button: "I have difficulties defining what the problem is"
- Function: Tag the problem section including audio
- Save to specific archive for teacher discussion
- Message: "No problem! We'll save this for you to discuss with your teacher later. Let's continue with trying different strategies."
- Navigation: Continue to Screen B2-3

**Navigation:** Proceed to Screen B2-3

---

### Screen B2-3: Test at Slower Tempo

**Title:** Slow Down and Check

**Instruction to User:**
"Play the passage at a slower tempo. Feel free to use the metronome if you need it. Does the problem persist at this slower tempo?"

**Features:**
- Integrated metronome control
- Tempo adjustment slider
- Optional recording

**User Response Options:**

#### If "Yes" (Problem persists at slow tempo) → Screen B3
**Message:** "The problem appears to be technical in nature. Let's explore targeted strategies to solve it."
**Navigation:** Proceed to Screen B3 (Targeted Strategies)

#### If "No" (Problem disappears at slow tempo) → Screen B2-3 Coordination Sub-Loop
**Message:** "The issue seems to be related to coordination or tempo control. Let's work on gradually increasing the speed."
**Navigation:** Proceed to Screen B2-3 Coordination Sub-Loop

---

### Screen B2-3 Coordination Sub-Loop: Gradual Tempo Increase

**Title:** Build Coordination at Speed

**Message to User:**
"This is a coordination issue. We'll gradually increase the tempo until you can play the passage cleanly at full speed."

#### Strategy 1: Gradual Metronome Increase

**Instruction to User:**
"Try playing the passage at the current slow tempo with the metronome. Once you can play it cleanly 2-3 times in a row, increase the metronome tempo slightly and repeat. Continue gradually increasing the tempo until you reach your target speed."

**Features:**
- Metronome tempo slider
- Suggested increment (e.g., +5 BPM per attempt)
- Ability to record multiple attempts
- Progress tracking

**User Response Options:**
- "Yes, I can solve it this way"
- "No, I'm still having difficulties"
- "Partially, but I need more strategies"

#### Additional Coordination Strategies (To Be Developed)

**Admin Note:** The following strategies should be developed with clear explanations and eventually video demonstrations:

1. **Play with Different Rhythmic Patterns**
   - Example: Add dots, change note groupings, etc.
   - Purpose: Reduce automatic muscle memory and rebuild with focus

2. **Reduce and Add Notes**
   - Play only certain notes first, then gradually add more
   - Purpose: Simplify the technical demand

3. **Anchor Notes and Stopping Points**
   - Define specific "anchor" notes where you stop and reset
   - Play between anchors with clean technique
   - Purpose: Break the passage into manageable segments

4. **Grouping**
   - Organize notes into logical musical groups
   - Play each group as a unit
   - Purpose: Create musical structure that aids memory

5. **Articulation Variations**
   - Play legato (smooth)
   - Play staccato (bouncy)
   - Play portato (separated but connected)
   - Play with variable legato (2-note, 3-note, etc.)
   - Purpose: Change the muscle movement pattern to reveal the fundamental issue

6. **Left Hand Only (Silence)**
   - Play the fingering without the bow
   - Purpose: Isolate left-hand coordination

7. **Right Hand/Bow Only**
   - Play with an open string or without pressing fingers
   - Purpose: Isolate bow coordination and rhythm

8. **Pizzicato**
   - Pluck the strings instead of bowing
   - Purpose: Remove bow coordination variable

**Structure for Admin:**
- Each strategy should have:
  - Clear, one-line title
  - 2-3 sentence explanation of what to do
  - Reason why this helps (pedagogical purpose)
  - Eventually: demonstration video
- Organize strategies from simplest to most complex
- Avoid overwhelming the user—present 1-2 strategies at a time

**If Strategies Don't Help:**
**Navigation:** Proceed to Screen B3 (Targeted Strategies based on focus category)

**Message:** "These coordination strategies didn't fully solve it. Let's explore other possibilities based on your focus area."

---

## Section B3: Targeted Strategy Selection Based on Focus Category

### Screen B3: Confirm Focus Category

**Title:** Verify Your Focus Area

**Message to User:**
"Before we continue, let's make sure we're still focusing on the right aspect of your playing."

**Question to User:**
"Is the focus still **[Focus Category]**?"

**Options:**
- **"Yes, keep this focus"** → Proceed to B3-1 with current focus
- **"No, my focus has shifted"** → Show focus category selector

**Focus Category Selector (If "No" Selected):**
- Rhythm/Pulse
- Intonation
- Sound Quality/Articulation
- Bow Control
- Coordination
- Other (user-defined)

**Message:** "No problem! That's actually very helpful—sometimes as we practice, we discover different issues. Let's shift focus to [New Category]."

**Navigation:** Proceed to B3-1 with updated focus category

---

### Section B3-1: Targeted Problem-Solving Strategy Trees

**Message to User (Explanation):**
"Now we'll go through some questions to understand the root of the problem and suggest appropriate solving strategies. These questions progress from basic understanding to more advanced technical aspects. There's no pressure—take your time with each one."

**General Structure for All Strategy Trees:**
- Questions appear as separate screens
- Each question has Yes/No answers
- Yes/No answers lead to next questions in sequence
- Certain answers trigger a specific strategy screen
- After applying a strategy, user can continue to the next question
- Skip button available (except when marked necessary)

---

## B3-1-1: Intonation Problem-Solving Strategy Tree

### Question 1: Understanding Intervals & Sound Representation

**Screen Title:** Do You Understand the Intervals?

**Question to User:**
"Do you understand exactly what intervals (distances) are between each note or finger in this section, and how they are supposed to sound?"

**If User Selects "No":**

**Strategy Screen: Study the Intervals**

**Instruction to User:**
"Let's make sure you completely understand the intervallic structure. Read through the sheet music of the problem section and make every interval 100% clear to yourself."

**Specific Actions:**
1. Understand the distance between fingers
   - How far apart should each finger be from the others?
   - Which fingers are close, which are far?

2. Understand the position
   - What position are you in?
   - Where are the shifts?

3. Internalize the sound (choose any or all):
   - Sing the passage
   - Play it on another instrument if available
   - Listen to a recording while following the score

**Pedagogical Explanation to User:**
"Why does this matter? Without a clear understanding of what you want to play, it's nearly impossible to detect errors or fix them. Your hands need a target."

**Navigation:** Return to Question 1 (Re-ask) or proceed to Question 2

**If User Selects "Yes":** Proceed to Question 2

---

### Question 2: Can You Hear When Notes Are Out of Tune?

**Screen Title:** Can You Hear Intonation Errors?

**Question to User:**
"When you play, do you clearly hear which notes are out of tune?"

**If User Selects "No":**

**Strategy: Build a Clear Mental Reference**

**Message to User:**
"You need a clear mental reference of how the section should sound. Let's build that together."

**Option A: Listen to a Recording**

**Instruction:**
"Listen to a high-quality recording of this passage. As you listen, try to internalize the sound and commit it to memory. Then, play the same passage and compare your playing to what you heard in the recording."

**Process:**
1. Listen to recording with full attention (1-2 times)
2. Play the passage
3. Compare: "Does my playing match what I heard?"
4. Listen again if needed
5. Repeat until the reference is clear

**Option B: Practice with a Drone Note**

**Instruction:**
"A drone note is a sustained reference pitch. This helps train your ear to hear and correct intonation."

**Process:**
1. Choose your drone note (the tonic of your section)
2. Play each note in the passage slowly, listening carefully to how it harmonizes with the drone
3. Hold each note as long as needed
4. Adjust the pitch until you feel and hear the "comfort and beauty" of the harmony between your note and the drone
5. Repeat the passage multiple times
6. Notice: Each time you play, you'll find the correct pitch more quickly
7. Once you consistently hit the right pitch from the start, play more fluently

**Pedagogical Explanation to User:**
"Why does this matter? We're creating a clear reference in your mind and body. Your ear and fingers need to know exactly how the correct pitch feels and sounds. This reference helps you compare what you actually play with what you want to play."

**Navigation:** Return to Question 2 or proceed to Question 3

**If User Selects "Yes":** Proceed to Question 3

---

### Question 3: Can You Correct Out-of-Tune Notes, But Only After Playing Them?

**Screen Title:** Direct vs. Corrected Intonation

**Question to User:**
"Does a note sound out of tune when you first play it, and you can only find the right pitch by correcting it afterward—but you never hit it directly on the first try?"

**If User Selects "Yes":**

**Strategy: Hit the Note Directly**

**Congratulations Message:**
"Great news! You already have a good reference in your mind, since you can hear when something is out of tune and you can correct it. The challenge now is to hit the note correctly on the first attempt."

**The Exercise:**

**Instruction:**
"We'll practice hitting the correct pitch immediately, without correction afterward. This trains your muscle memory to reach the right pitch directly."

**Setup:**
1. Position your hand on the violin as normal
2. Play a note in the problem section
3. Stop immediately (don't correct)
4. Ask yourself: "Did I hit the note too sharp, too flat, or correctly?"
5. Note your observation
6. Reset your hand slightly and try again
7. This time, aim higher or lower based on what you learned
8. Repeat until you hit the note correctly several times in a row
9. Progress through the passage note by note

**Important:** Never correct a note after you play it. Just observe and try again.

**Pedagogical Explanation to User:**
"Why does this matter? Your body learns and memorizes movement patterns, especially after many repetitions. If you always play a note incorrectly and then correct it, your muscles memorize the incorrect movement as 'normal.' We need to teach your body to reach the correct pitch immediately, so it memorizes the right movement pattern from the start."

**If This Exercise Doesn't Fully Solve It:**
"This is a good foundation. Let's continue with the next strategy."

**Navigation:** Proceed to Question 4

**If User Selects "No":** Proceed to Question 4

---

### Question 4: Internal Anticipation - Do You Imagine the Note Before Playing?

**Screen Title:** Mental Preparation Before Playing

**Question to User:**
"Do you imagine the sound and feeling of each note before you play it?"

**If User Selects "No":**

**Strategy: Develop Internal Anticipation**

**Instruction to User:**
"We'll practice imagining exactly what you want to play before you play it. This creates a mental blueprint your fingers can follow."

**The Exercise:**

**Setup:**
1. Set a very slow tempo (approximately half your normal tempo)
2. Before playing each note, pause for a moment
3. Imagine as precisely as possible:
   - The pitch (how high or low it should be)
   - The feeling in your hands when playing that note
   - Where your finger should be on the fingerboard
4. Now play the note
5. Compare: Does the actual sound match what you imagined?
6. Move to the next note and repeat

**Duration:** Practice this slowly for 5-10 minutes at a time

**Progression:**
- Week 1-2: Very slow, with significant pause before each note
- Week 3-4: Slow, with shorter pause
- Week 5+: Normal tempo, with anticipation becoming automatic

**Pedagogical Explanation to User:**
"Why does this matter? When you imagine what you want to play beforehand, you'll recognize immediately if something sounds different. You'll catch intonation problems right away instead of after the fact. Additionally, the mental and physical feeling you imagine creates a reference in your mind. You'll know exactly what you did (what you imagined) when a note ends up too sharp or too flat. Next time, you can anticipate the correct feeling of placing your finger slightly higher or lower."

**Navigation:** Proceed to Question 5

**If User Selects "Yes":** Proceed to Question 5

---

### Question 5: Persistent Sharp or Flat Notes

**Screen Title:** Consistent Intonation Patterns

**Question to User:**
"Do you still have difficulties with specific notes that consistently end up being too sharp or too flat?"

**If User Selects "Yes":**

**Strategy: Exaggeration Exercise**

**Instruction to User:**
"We'll use exaggeration to expand your awareness of pitch range and train your muscles."

**The Exercise:**

**Setup:**
1. Identify which notes are consistently sharp or flat
2. Exaggerate in the opposite direction:
   - If the note is always too flat → Aim extremely high (even unnaturally high)
   - If the note is always too sharp → Aim extremely low (even unnaturally low)
3. Play the exaggerated version 3-5 times
4. Return to the correct pitch
5. Notice: The correct pitch now feels easier to reach

**Why This Works:**
"Exaggeration helps you discover the full range of possibilities you can physically achieve. By aiming at an extreme, you expand the limits your body unconsciously feels. After exaggerating a few times, hitting the correct pitch becomes easier."

**Example:**
- If you always play a high D sharp when you mean to play D natural:
  - Play D natural, but aim for a C sharp (much lower than you need)
  - This shows your body it can reach much lower
  - Return to D natural—it now feels higher and more accessible

**Navigation:** Proceed to Question 6

**If User Selects "No":** Proceed to Question 6

---

### Question 6: Physical Tension or Discomfort

**Screen Title:** Check for Physical Tension

**Question to User:**
"Do you feel physical discomfort, tension, or strain when trying to play in tune?"

**If User Selects "Yes":**

**Strategy: Identify and Release Physical Tension**

**Message to User:**
"Physical tension often prevents good intonation. Your muscles cannot work efficiently when they're tense. Let's identify where the tension is and work on releasing it."

**Professional Option:**
"If possible, ask your teacher for feedback. A teacher can often spot tension patterns that are difficult to identify yourself."

**Self-Guided Assessment:**

Check each of these areas while you play the problem section:

**Feet & Legs:**
- Are your feet in a comfortable, balanced position?
- Do you feel grounded and stable?
- Are your knees relaxed, or locked/tense?

**Spine & Back:**
- Is your back straight and centered, or tilted/rotated?
- Keep your spine aligned vertically
- Your back should feel relaxed, not rigid

**Shoulders:**
- Do you feel tension in your shoulders or shoulder blades?
- Shoulders should be relaxed and sitting naturally
- They should not be pulled up toward your ears
- Check both shoulders—are they level with each other?

**Elbow (Right Arm):**
- Is your elbow relaxed?
- Imagine a small stone tied to your elbow, gently pulling it downward due to gravity
- Your elbow should "hang" with gravity, not be tense, tilted, or locked
- Check while bowing—does your elbow move freely?

**Wrist (Left Hand):**
- Is your wrist relaxed when you play?
- Exercise: Hold the violin in playing position, relax your wrist completely, and notice the feeling
- Try to maintain that relaxed feeling while actually playing
- Your wrist should flex naturally, not be stiff

**Thumb (Left Hand):**
- Is your thumb tense or relaxed?
- Your thumb and fingers work together as a team
- All fingers should touch the fingerboard softly, not push or press hard
- Check if you're gripping the neck of the violin—you shouldn't be

**Visual Aid (Admin):**
Add a labeled diagram of a person playing violin, with problem areas highlighted and annotated.

**Admin Note:** In future development, create a comprehensive body tension module with:
- Specific exercises for each tension area
- Video demonstrations of tension vs. relaxation
- Guidance for when to seek teacher feedback
- Progressive body awareness training

**Navigation:** Proceed to Screen B3 End or back to B3-1 as needed

**If User Selects "No":** Proceed to Screen B3-1-1 End (below)

---

### Screen B3-1-1 End: Intonation Strategy Tree Complete

**Message to User:**
"You've worked through the intonation strategies. Great effort!"

**Options:**
1. **"Continue to Coordination Loop"** → See if the issue is now resolved
2. **"Try Another Strategy"** → Return to any previous question
3. **"Save This for Teacher Discussion"** → Archive the problem and your work for later review

**If Continuing to Coordination Loop:**
**Message:** "Now we'll work on coordinating this passage at full speed to make sure it sounds clean and confident in the final tempo."

**Navigation:** Proceed to Coordination Loop (future development)

---

## Section B4: After Strategy Application - Coordination Loop

**Screen Title:** Final Coordination and Tempo

**Message to User:**
"Excellent work on the technical aspects! Now we'll bring everything together at performance tempo. This ensures your passage sounds clean, confident, and musical at full speed."

**Process:**
1. Play the passage at your target tempo (possibly with metronome support)
2. Evaluate: Does the passage now sound better?
3. Record and listen back if needed
4. If still issues: Return to specific strategies or skip back to problem isolation
5. If resolved: Move to next passage or end practice session

**Navigation Options:**
- "The issue is fixed—move to next passage" → Restart Loop from beginning
- "I still have problems" → Return to problem isolation or strategy selection
- "I want to practice more for stability" → Enter stability loop (future development)
- "End practice session" → Exit app

---

## Admin Implementation Notes

### Required Development Areas

1. **Strategy Videos**
   - Eventually add demonstration videos for each strategy
   - Show both correct and common incorrect forms
   - Include multiple examples (different notes/positions)

2. **Archive System**
   - Store all identified problems from a practice session
   - Include recording, written description, timestamp
   - Allow teacher to review and provide feedback
   - Searchable by problem type, date, passage

3. **Stability Loop** (Referenced but not yet detailed)
   - Design focused practice strategies for building consistency
   - Include repetition with specific quality checkpoints

4. **Coordination Loop** (Referenced but not yet detailed)
   - Develop comprehensive tempo-building strategies
   - Include hand synchronization work
   - Connect to articulation and rhythm

5. **Body Tension Module** (Future expansion)
   - Comprehensive body awareness exercises
   - Video demonstrations for each tension area
   - Guidance for when to involve a teacher

6. **Additional Focus Categories** (Future expansion)
   - Currently detailed: Intonation
   - Need to develop: Rhythm/Pulse, Sound Quality/Articulation, Bow Control
   - Each should follow similar question/strategy tree structure

### Content Formulation Notes

- Pedagogical explanations use accessible language
- "Why does this matter?" sections explain the reasoning (increases engagement and compliance)
- Instruction steps are numbered and clear
- Examples are concrete and relatable to student experience
- Encourages self-discovery rather than just following instructions

---

## Quick Reference: Loop B Navigation Map

```
Start: Issue Detected → B1: Does issue persist?
                          ├─ No → B1-2: Next passage or stability loop
                          └─ Yes → B1-3: Begin diagnosis
                                     ↓
                              B2-1: Isolate problem
                                     ↓
                              B2-2: Identify problem
                                     ↓
                              B2-3: Test at slow tempo
                                     ├─ Yes (persists) → B3
                                     └─ No (tempo issue) → B2-3 Coordination Sub-Loop
                                                              ↓
                                                        (Try strategies)
                                                              ↓
                                     If strategies don't help → B3
                                     
                              B3: Confirm focus category
                                     ↓
                              B3-1-1: Focus-based strategy tree
                                     (Intonation shown in detail)
                                     ├─ Question 1: Understand intervals
                                     ├─ Question 2: Hear errors
                                     ├─ Question 3: Direct vs. corrected
                                     ├─ Question 4: Internal anticipation
                                     ├─ Question 5: Persistent sharp/flat
                                     └─ Question 6: Physical tension
                                            ↓
                              B3-1-1 End: Apply strategies
                                     ↓
                              B4: Coordination and final tempo
                                     ↓
                              End or restart
```
