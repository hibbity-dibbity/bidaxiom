# Claude Code Efficiency Guide

Guidelines for minimizing token usage when debugging with Claude Code.

## 🎯 Quick Reference: Bug Report Template

When reporting issues, use this format to minimize back-and-forth:

```
SYMPTOM: [What you observe - be specific]
ERROR: [Exact error message - copy/paste]
WHAT I TRIED: [What you already attempted]
URL/STATE: [What URL/page you're on]
BROWSER INFO: [Any console errors or network tab info]
```

### Example:
```
SYMPTOM: Login succeeds but doesn't redirect
ERROR: No error in UI, but browser console shows: [paste]
WHAT I TRIED: Cleared cookies, restarted servers
URL/STATE: Stays on http://localhost:3000/sign-in?redirect_url=%2Fonboarding
BROWSER INFO: Network tab shows /api/auth/login returns 500
```

## 📝 User Guidelines

### 1. Always Include Error Messages
❌ **Avoid:** "same error" or "still broken"
✅ **Instead:** Copy the actual error message:
```
"Zero-length key is not supported"
```

**Why:** Saves ~3,000 tokens per incident (avoids reading entire log files)

---

### 2. Be Specific with Confirmations
❌ **Avoid:** "Yes" (ambiguous)
✅ **Instead:**
- "Yes, delete the account"
- "Yes, I'll just log in"

**Why:** Prevents misunderstandings and wasted actions

---

### 3. Provide Context About What You Tried
❌ **Avoid:** "Verification link is invalid"
✅ **Instead:**
- "After deleting user and signing up fresh, verification link says: Invalid or expired verification token"

**Why:** Avoids redundant investigation of already-attempted solutions

---

### 4. Include URL/State Information
❌ **Avoid:** "Login doesn't redirect"
✅ **Instead:**
- "Login stays on sign-in page but URL changed to: `http://localhost:3000/sign-in?redirect_url=%2Fonboarding`"

**Why:** Immediately reveals root cause (middleware issue) - saves ~6,000 tokens

---

### 5. Check Browser DevTools When Asked
When debugging frontend issues:
1. Open DevTools (F12)
2. Check **Network** tab for failed requests
3. Check **Console** tab for errors
4. Copy/paste relevant info

**Why:** Faster than Claude reading entire API log files - saves ~4,000 tokens

---

### 6. Do Simple Manual Tasks
When Claude suggests simple actions, do them yourself:
- Restart servers
- Clear browser cache
- Check database with provided SQL
- Clear rate limits with provided Redis commands

**Why:** Faster execution, fewer roundtrips - saves ~1,000 tokens

---

### 7. Copy Recent Output Instead of Full Logs
❌ **Avoid:** Making Claude read 500-line log files
✅ **Instead:** Copy the last 10-20 lines from your terminal

**Why:** Saves ~3,000 tokens per log read

---

## 🤖 Claude Guidelines

### 1. Ask Before Investigating
Before reading files/logs, ask:
- "What's the exact error message?"
- "Where did it redirect you?"
- "What do you see in the browser console?"
- "What's the URL in the address bar?"

**Token savings:** ~6,000 tokens per incident

---

### 2. Use Targeted File Reading
❌ **Avoid:** Reading entire files
✅ **Instead:**
```typescript
// Read just recent output
Read with offset: -30, limit: 30

// Search first, then read specific sections
Grep for error pattern, then Read around that line
```

**Token savings:** ~3,000 tokens per file read

---

### 3. Leverage Browser Tools
Before reading logs, ask user to:
- Check Network tab for API calls
- Check Console for errors
- Screenshot the issue

**Token savings:** ~4,000 tokens

---

### 4. Combine Operations
❌ **Avoid:** Multiple separate database queries
✅ **Instead:** Single JOIN query with all needed data

**Token savings:** ~500 tokens per query set

---

### 5. Suggest Manual Actions Proactively
When appropriate, ask user to:
- "While I fix this, please restart the API server"
- "Can you clear your browser cache and try again?"
- "Open DevTools Network tab and tell me what you see"

**Token savings:** ~1,000 tokens (less back-and-forth)

---

### 6. Use Grep Aggressively
❌ **Avoid:** Reading entire auth.ts to find verifyEmail
✅ **Instead:**
```bash
Grep for "verifyEmail:" first → find line number
Then Read with offset around that line
```

**Token savings:** ~1,000 tokens per search

---

## 📊 Impact Summary

Following these guidelines in a typical debugging session:

| Pattern | Tokens Saved |
|---------|--------------|
| Include error messages upfront | ~12,000 |
| Ask before investigating | ~6,000 |
| Use targeted log reading | ~9,000 |
| Leverage browser DevTools | ~4,000 |
| Manual tasks | ~1,000 |
| Be specific with responses | ~500 |
| **Total per session** | **~32,500** |

**Monthly savings** (10 debugging sessions): **~325,000 tokens**

---

## ✅ What Worked Well

Patterns to continue:
- Quick execution when instructions are clear
- Trying solutions yourself first
- This meta-review (excellent token investment!)

---

## 🔄 Continuous Improvement

This guide will be updated as we discover new efficiency patterns.

**Last updated:** 2026-02-14
