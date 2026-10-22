# Contributing to Attendly

Thank you for your interest in contributing to **Attendly**! We welcome contributions from developers, educators, researchers, and designers worldwide to make attendance management simple, privacy-respecting, and free for all universities.

---

## 🧭 Code of Conduct

Please treat everyone with respect, kindness, and professionalism. We are committed to providing a welcoming, inclusive, and harassment-free community.

---

## 🛠️ Development Setup

Attendly is built using:
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5
- **Database:** SQLite with Prisma ORM
- **Authentication:** NextAuth.js v5
- **Desktop Runtime:** Electron.js
- **Styling:** Tailwind CSS with custom academic design tokens
- **Testing:** Jest + Testing Library

### Prerequisites
- [Node.js](https://nodejs.org/) v18.0.0 or higher
- `npm` (bundled with Node.js)
- `git`

### Quick Start
```bash
# 1. Clone the repository
git clone https://github.com/Gheorghe-dev/Attendly.git
cd Attendly

# 2. Install dependencies
npm install

# 3. Initialize environment variables
cp .env.example .env
# Replace NEXTAUTH_SECRET with a random value from:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 4. Generate Prisma client & create SQLite database
npx prisma db push

# 5. (Optional) Seed demo instructor account
npm run db:seed

# 6. Start development server
npm run dev
```

The app will be accessible at: **`http://localhost:3000`**

---

## 🧪 Running Tests & Quality Checks

Before opening a pull request, ensure all tests and lint checks pass cleanly:

```bash
# Run unit test suite
npm test

# Run ESLint validation
npm run lint

# Verify full production build
npm run build

# Run automated end-to-end verification
npx tsx scripts/verify-all.ts
```

---

## 📂 Project Structure

```
├── electron/              # Electron desktop wrapper and native window configuration
├── prisma/                # SQLite schema and migration definitions
├── public/                # Static assets, logos, and emblems
├── scripts/               # Production launchers, verification scripts, and utilities
├── seed/                  # Sample rosters and Excel generator helpers
├── src/
│   ├── app/               # Next.js App Router (pages and API endpoints)
│   ├── components/        # Reusable UI components and modal dialogs
│   └── lib/               # Business logic (classroom routing, distance, auth, Excel)
├── tests/                 # Jest automated test suites
├── Dockerfile             # Multi-stage production container
└── docker-compose.yml     # Zero-config container deployment
```

---

## 💡 Submitting Changes

1. **Fork** the repository and create a branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. **Commit** your changes with clear, descriptive commit messages:
   ```bash
   git commit -m "Add feature: support multi-language Excel headers"
   ```
3. **Push** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
4. **Open a Pull Request** against the `main` branch with a summary of changes and test results.

---

## 📄 License

By contributing to Attendly, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
