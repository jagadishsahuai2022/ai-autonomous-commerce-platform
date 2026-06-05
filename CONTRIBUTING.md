# CONTRIBUTING.md - Contributing Guidelines

## 🤝 How to Contribute

Thank you for your interest in contributing to the AI Commerce Platform! This guide will help you get started.

## 📋 Prerequisites

- Node.js >= 20.0.0
- Python >= 3.11
- Git
- Familiarity with TypeScript, NestJS, Next.js, or FastAPI

## 🚀 Getting Started

### 1. Fork and Clone

```bash
# Fork the repository
# Clone your fork
git clone https://github.com/YOUR_USERNAME/ai-commerce-platform.git
cd ai-commerce-platform

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL_REPO/ai-commerce-platform.git
```

### 2. Create Feature Branch

```bash
# Update main
git fetch upstream
git checkout main
git rebase upstream/main

# Create feature branch
git checkout -b feature/your-feature-name
```

### 3. Setup Development Environment

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Start development server
npm run dev
```

## 📝 Development Workflow

### Code Style

Follow these conventions:

#### TypeScript/JavaScript

```typescript
// ✅ Good
export class UserService {
  async getUserById(userId: number): Promise<User> {
    const user = await this.db.query(userId);
    if (!user) throw new NotFoundException();
    return user;
  }
}

// ❌ Bad
export class UserService {
  getUserById(userId) {
    return db.query(userId); // No type checking
  }
}
```

#### Python

```python
# ✅ Good
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

class User(BaseModel):
    id: int
    email: str

async def get_user(user_id: int) -> User:
    user = await db.fetch_user(user_id)
    if not user:
        raise HTTPException(status_code=404)
    return user

# ❌ Bad
def get_user(user_id):
    return db.fetch_user(user_id)  # No typing
```

### File Structure

```
Module Structure:
src/modules/product/
├── product.module.ts       # Module definition
├── product.controller.ts   # API endpoints
├── product.service.ts      # Business logic
├── dto/
│   ├── create-product.dto.ts
│   └── update-product.dto.ts
└── __tests__/
    ├── product.service.spec.ts
    └── product.controller.spec.ts
```

### Naming Conventions

| Type        | Convention                  | Example           |
| ----------- | --------------------------- | ----------------- |
| Modules     | `PascalCase` + `Module`     | `UserModule`      |
| Services    | `PascalCase` + `Service`    | `UserService`     |
| Controllers | `PascalCase` + `Controller` | `UserController`  |
| DTOs        | `PascalCase` + `Dto`        | `CreateUserDto`   |
| Files       | `kebab-case`                | `user.service.ts` |
| Variables   | `camelCase`                 | `userData`        |
| Constants   | `UPPER_CASE`                | `MAX_USERS`       |

## 🧪 Testing

### Writing Tests

```typescript
// Example: product.service.spec.ts
describe('ProductService', () => {
  let service: ProductService;

  beforeEach(() => {
    service = new ProductService();
  });

  it('should return products', () => {
    const products = service.findAll();
    expect(products).toBeDefined();
    expect(Array.isArray(products)).toBe(true);
  });

  it('should handle errors gracefully', () => {
    expect(() => service.findOne(-1)).toThrow();
  });
});
```

### Running Tests

```bash
# Frontend
cd apps/web
npm test

# API
cd apps/api
npm test

# AI Service (coming soon)
cd apps/ai-service
pytest
```

## 📋 Before Submitting

### Pre-Commit Checks

```bash
# Run all quality checks
npm run type-check  # TypeScript checking
npm run lint        # ESLint
npm run format      # Prettier

# Or use a pre-commit hook
git add .
npm run lint        # Will fail if issues found
```

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>

Examples:
- feat(product): add product filtering by category
- fix(api): resolve CORS issue on auth endpoint
- docs(readme): update setup instructions
- style(web): format component files
- refactor(api): extract validation logic
- test(product): add unit tests for service
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

## 🔄 Pull Request Process

### 1. Create Pull Request

```bash
# Push your branch
git push origin feature/your-feature-name

# Create PR on GitHub
# Link related issues
# Add description
```

### 2. PR Description Template

```markdown
## Description

Brief description of changes

## Related Issues

Fixes #123

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Changes Made

- [ ] Change 1
- [ ] Change 2

## Testing

- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] No console errors/warnings

## Screenshots (if applicable)

Before:
After:

## Checklist

- [ ] Code follows project style
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No breaking changes
```

### 3. Code Review Process

- At least 2 approvals required
- All CI checks must pass
- Conflicts must be resolved
- Requested changes must be addressed

## 🐛 Reporting Bugs

### Bug Report Template

```markdown
## Description

Clear description of the bug

## To Reproduce

1. Step 1
2. Step 2
3. ...

## Expected Behavior

What should happen

## Actual Behavior

What actually happens

## Environment

- OS: (e.g., Windows 10)
- Node: (e.g., 20.0.0)
- Browser: (if applicable)

## Screenshots

Attach relevant screenshots

## Logs

Include error logs/stack traces
```

## ✨ Feature Requests

### Feature Request Template

```markdown
## Description

Clear description of the feature

## Motivation

Why is this needed?

## Proposed Solution

How should it work?

## Alternatives

Other approaches considered

## Additional Context

Screenshots, examples, references
```

## 📚 Documentation

### Adding Documentation

1. **README Updates**: Link major changes in README
2. **Code Comments**: Explain complex logic
3. **Type Definitions**: Always provide TypeScript types
4. **API Docs**: Document endpoints

Example API documentation:

```typescript
/**
 * Get user by ID
 * @param userId - The user's unique identifier
 * @returns User object
 * @throws NotFoundException if user doesn't exist
 * @example
 * const user = await getUserById(123);
 */
export async function getUserById(userId: number): Promise<User> {
  // implementation
}
```

## 🚀 Performance Guidelines

### Best Practices

1. **Database Queries**
   - Add indexes for frequently queried columns
   - Avoid N+1 queries
   - Use pagination for large result sets

2. **Caching**
   - Cache frequently accessed data
   - Implement proper cache invalidation
   - Consider TTL values

3. **Frontend**
   - Code splitting and lazy loading
   - Image optimization
   - Minimize bundle size

4. **API**
   - Rate limiting
   - Request validation
   - Response compression

## 🔐 Security Guidelines

### Do's ✅

- Validate all user inputs
- Use environment variables for secrets
- Implement proper error handling
- Log security events
- Use HTTPS/TLS

### Don'ts ❌

- Hardcode secrets
- Expose error stack traces to users
- Disable CORS globally
- Use deprecated libraries
- Log sensitive data

## 📦 Dependency Management

### Adding Dependencies

```bash
# Frontend
cd apps/web
npm install package-name

# API
cd apps/api
npm install package-name

# AI Service
cd apps/ai-service
pip install package-name
echo package-name >> requirements.txt
```

### Updating Dependencies

```bash
# Check for updates
npm outdated

# Update packages
npm update

# Update to latest major version (use caution)
npm install package-name@latest
```

## 🎓 Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Next.js Documentation](https://nextjs.org/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Clean Code in Python](https://peps.python.org/pep-0008/)

## 🆘 Need Help?

- **Questions**: Check existing GitHub issues
- **Documentation**: Read ARCHITECTURE.md
- **Examples**: Look at existing modules
- **Contact**: Tag maintainers in issues

## ✅ Code Review Checklist for Reviewers

- [ ] Code follows project conventions
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] No performance regressions
- [ ] Security best practices followed
- [ ] No hardcoded values
- [ ] Error handling implemented
- [ ] TypeScript types are correct
- [ ] No breaking changes
- [ ] Comments are clear

## 🎉 Thank You!

We appreciate your contributions to making AI Commerce Platform better!

---

**Last Updated**: April 2026  
**Version**: 1.0.0
