You are a Principal Engineer and Dev Environment Architect.

Your task is to set up a clean, scalable development environment for an AI commerce platform called "DelegateCart".

---

## 🎯 OBJECTIVE

Create a development setup with:

1. Two separate repositories:

   * delegatecart (existing web + backend)
   * delegatecart-mobile (new mobile app)

2. A single unified workspace folder:

   * Allows working on both repos together
   * Works seamlessly in VS Code
   * Improves GitHub Copilot context

3. Maintain:

   * Clean separation of repos
   * Independent CI/CD
   * Low complexity
   * Fast development workflow

---

## 📁 TARGET STRUCTURE

workspace/
├── delegatecart/
├── delegatecart-mobile/
└── delegatecart.code-workspace

---

## ⚠️ IMPORTANT RULES

* DO NOT merge repos into one
* DO NOT create monorepo
* DO NOT use git submodules
* DO NOT use git subtree
* Keep repos fully independent

---

## 📦 STEP 1: WORKSPACE SETUP

Generate:

1. Folder creation commands
2. Git clone commands (placeholders for repo URLs)
3. VS Code multi-root workspace file

File: delegatecart.code-workspace

Include:

* both repos as folders
* basic TypeScript setting

---

## 📦 STEP 2: VS CODE TASKS

Create tasks.json that allows:

* Run web app (delegatecart)
* Run mobile app (delegatecart-mobile)

Ensure:

* correct working directory for each
* simple commands

---

## 📦 STEP 3: MOBILE APP SETUP

Inside delegatecart-mobile:

Generate:

1. Expo + React Native + TypeScript setup commands

2. Minimal dependencies:

   * React Navigation
   * Zustand
   * Axios
   * React Query
   * NativeWind

3. Clean folder structure:
   /src
   /screens
   /components
   /services
   /store
   /hooks
   /utils
   /theme

---

## 📦 STEP 4: ENVIRONMENT CONFIG

Create:

* .env.example for mobile app
* Shared API base URL

Example:
API_BASE_URL=https://api.delegatecart.com

---

## 📦 STEP 5: API INTEGRATION (LEAN)

Create simple Axios setup:

* base client
* interceptor for auth token
* error handling

NO SDK
NO OpenAPI

---

## 📦 STEP 6: STATE MANAGEMENT

Create Zustand store example:

* auth state
* user info
* token storage

---

## 📦 STEP 7: BASIC SCREEN

Generate Home screen:

* fetch AI recommendations
* display product list
* include:

  * "Why this recommendation"
  * confidence score

---

## 📦 STEP 8: PLATFORM-SPECIFIC HANDLING

Show examples:

* Platform.OS usage
* iOS vs Android UI tweaks

---

## 📦 STEP 9: EAS BUILD SETUP

Generate:

* eas.json
* build profiles:

  * ios-prod
  * android-prod

Include commands to:

* build APK
* build IPA

---

## 📦 STEP 10: COST OPTIMIZATION

Explain clearly:

* what tools to avoid initially
* what to delay
* how to stay within free tiers

---

## 📦 STEP 11: COPILOT OPTIMIZATION

Explain:

* how this workspace improves Copilot context
* best practices:

  * open both repos
  * keep related files open
  * use inline prompts

---

## ⚠️ OUTPUT RULES

* Generate step-by-step
* Do NOT dump everything at once
* Keep everything minimal and practical
* Prefer simplicity over abstraction

---

## FINAL GOAL

A working development setup where:

* both repos run together
* mobile app is ready to build
* Copilot understands full system
* development is fast and low-cost
