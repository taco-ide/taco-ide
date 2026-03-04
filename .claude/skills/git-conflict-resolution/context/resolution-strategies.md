# Git Conflict Resolution Strategies

## Overview

This document describes five resolution strategies for different conflict types, with guidance on when to use each strategy, pros/cons, and testing requirements.

---

## Strategy 1: Accept Current (Keep Ours)

**Use When**: Current branch's version is clearly correct or more complete

**Characteristics**:
- Using code from current branch (HEAD before merge)
- Discarding all incoming changes
- Applicable when incoming is outdated or superseded

### When to Apply

- Main branch has more recent updates
- Feature branch changes are stale
- Incoming version is experimental or reverted
- Current branch implements superset of incoming

### Example

```python
# Conflict in error handling
# CURRENT (main): New comprehensive error handling
try:
    result = process(data)
except ValueError as e:
    logger.error(f"Invalid input: {e}")
    raise InputError(str(e)) from e
except ProcessingError as e:
    logger.error(f"Processing failed: {e}")
    raise SystemError(str(e)) from e

# INCOMING (feature): Old basic error handling
try:
    result = process(data)
except Exception as e:
    print(f"Error: {e}")
    raise e
```

**Decision**: Accept CURRENT (comprehensive error handling is better)

### Testing Requirements

```python
def test_accepts_current_error_handling():
    """Verify current branch's error handling is preserved."""
    with pytest.raises(InputError):
        process(invalid_data)

    # Verify logging is applied
    with patch('logger.error') as mock_log:
        try:
            process(invalid_data)
        except InputError:
            pass
        assert mock_log.called
```

### Pros
- Fast decision
- No merging complexity
- Clear ownership of code path
- Current branch likely more tested

### Cons
- Loses any improvements from incoming
- May need rebase if incoming had critical fixes
- Team disagreement if incoming was important

---

## Strategy 2: Accept Incoming (Take Theirs)

**Use When**: Incoming branch's version is clearly correct or more advanced

**Characteristics**:
- Using code from incoming branch (branch being merged in)
- Discarding all current changes
- Applicable when current is outdated or reverted

### When to Apply

- Feature branch has significant improvements
- Current branch changes are stale
- Incoming version is more modern/tested
- Current branch implements subset of incoming

### Example

```python
# Conflict in user authentication
# CURRENT (main): Old email-based auth
def authenticate(email: str, password: str) -> bool:
    user = User.find_by_email(email)
    return user and verify_password(password, user.password_hash)

# INCOMING (feature): New email or username auth
def authenticate(email_or_username: str, password: str) -> bool:
    user = User.find_by_email_or_username(email_or_username)
    return user and verify_password(password, user.password_hash)
```

**Decision**: Accept INCOMING (more flexible authentication)

### Testing Requirements

```python
def test_accepts_incoming_auth_flexibility():
    """Verify incoming branch's flexible auth is used."""
    # Should work with email
    assert authenticate('user@example.com', 'password')
    # Should work with username
    assert authenticate('john_doe', 'password')
    # Should fail with wrong password
    assert not authenticate('user@example.com', 'wrong')
```

### Pros
- Incoming likely more recent and tested
- Avoids rework of incoming branch
- Simplifies the merge
- Feature branch gets fully merged

### Cons
- May lose improvements from current
- Risk if current had critical fixes
- Should verify incoming is fully compatible

---

## Strategy 3: Manual Merge (Combine Both)

**Use When**: Both versions have valuable changes that should coexist

**Characteristics**:
- Manually combining code from both branches
- Requires careful integration and testing
- Most complex but often most correct
- Creates NEW merged version

### When to Apply

- Both branches add different features
- Changes are independent and complementary
- Both have valuable improvements
- Can be safely combined

### Example

```python
# Conflict in user model - both branches add fields
# CURRENT (main): Adds email verification tracking
class User:
    def __init__(self, name: str, email: str):
        self.name = name
        self.email = email
        self.email_verified = False

    def verify_email(self, token: str) -> bool:
        # Verification logic
        if token == self.verification_token:
            self.email_verified = True
            return True
        return False

# INCOMING (feature): Adds login tracking
class User:
    def __init__(self, name: str, email: str):
        self.name = name
        self.email = email
        self.last_login = None

    def record_login(self) -> None:
        self.last_login = datetime.now()

# MERGED VERSION: Both features
class User:
    def __init__(self, name: str, email: str):
        self.name = name
        self.email = email
        self.email_verified = False
        self.last_login = None

    def verify_email(self, token: str) -> bool:
        if token == self.verification_token:
            self.email_verified = True
            return True
        return False

    def record_login(self) -> None:
        self.last_login = datetime.now()
```

**Decision**: COMBINE BOTH (both features are valuable and independent)

### Testing Requirements

```python
def test_merged_user_has_email_verification():
    """Verify email verification feature from current."""
    user = User('John', 'john@example.com')
    assert not user.email_verified
    user.verify_email('valid_token')
    assert user.email_verified

def test_merged_user_has_login_tracking():
    """Verify login tracking feature from incoming."""
    user = User('John', 'john@example.com')
    assert user.last_login is None
    user.record_login()
    assert user.last_login is not None

def test_merged_user_both_features():
    """Verify both features work together."""
    user = User('John', 'john@example.com')
    # Setup email verification
    user.verify_email('valid_token')
    # Track login
    user.record_login()
    # Both should work
    assert user.email_verified
    assert user.last_login is not None
```

### Merge Patterns

**Adding independent fields**:
```python
# Current adds one field, incoming adds another
# MERGED: Include both fields
class Config:
    def __init__(self):
        self.timeout = 30      # From current
        self.retry_count = 3   # From incoming
```

**Adding complementary methods**:
```python
# Current adds method A, incoming adds method B
# MERGED: Include both methods
class DataProcessor:
    def validate(self) -> bool:       # From current
        pass

    def transform(self) -> dict:      # From incoming
        pass
```

**Refactoring both approaches**:
```python
# Current refactors one way, incoming another way
# MERGED: Choose or combine, create hybrid approach
# May need to refactor further
```

### Pros
- Preserves both sets of improvements
- Often most complete solution
- Eliminates need for future remerge
- Teams get both features

### Cons
- Most complex and error-prone
- Requires deep understanding of both changes
- Testing must be comprehensive
- Risk of hidden incompatibilities
- May create larger diffs

---

## Strategy 4: Refactor to Eliminate Conflict

**Use When**: Conflict reveals poor design that should be refactored

**Characteristics**:
- Neither version is ideal
- Refactoring eliminates the conflict
- Produces cleaner, more maintainable code
- Requires architectural understanding

### When to Apply

- Conflict reveals design issue
- Both versions have limitations
- Refactoring improves overall code quality
- Extra refactoring time is worthwhile

### Example

```python
# Conflict in data validation
# CURRENT (main): Validates in one place
def process_user_data(data: dict) -> dict:
    if not data.get('email'):
        raise ValueError("Email required")
    if not data.get('name'):
        raise ValueError("Name required")
    # Process...

# INCOMING (feature): Validates in different place
def process_user_data(data: dict) -> dict:
    user = User(data)  # Validates in constructor
    user.validate()
    # Process...

# REFACTORED: Dedicated validation class
class UserValidator:
    @staticmethod
    def validate(data: dict) -> None:
        if not data.get('email'):
            raise ValueError("Email required")
        if not data.get('name'):
            raise ValueError("Name required")

def process_user_data(data: dict) -> dict:
    UserValidator.validate(data)
    # Process...

class User:
    def __init__(self, data: dict):
        UserValidator.validate(data)
        # Initialize...
```

**Decision**: REFACTOR to extract validation logic

### Testing Requirements

```python
def test_validation_separate_concern():
    """Verify validation is testable independently."""
    with pytest.raises(ValueError):
        UserValidator.validate({'name': 'John'})  # Missing email

    with pytest.raises(ValueError):
        UserValidator.validate({'email': 'john@example.com'})  # Missing name

    UserValidator.validate({'name': 'John', 'email': 'john@example.com'})

def test_user_uses_validation():
    """Verify User class validates input."""
    with pytest.raises(ValueError):
        User({'name': 'John'})

def test_process_uses_validation():
    """Verify process_user_data validates input."""
    with pytest.raises(ValueError):
        process_user_data({'name': 'John'})
```

### Refactoring Patterns

**Extract common logic**:
- Identify repeated validation/processing
- Create shared utility function
- Both versions use new function

**Improve abstraction**:
- Create interface or base class
- Both implementations inherit/implement
- Compose for specific behaviors

**Separate concerns**:
- Split validation from processing
- Split formatting from logic
- Create focused, testable components

### Pros
- Solves conflict and improves design
- More maintainable long-term
- Easier to test individual concerns
- Prevents similar conflicts in future
- Cleaner codebase

### Cons
- Requires more refactoring effort
- Needs careful testing
- Takes more time initially
- May not be appropriate for all conflicts

---

## Strategy 5: Escalate to Team

**Use When**: Unable to determine correct resolution without domain knowledge

**Characteristics**:
- Conflict requires business decision
- Unclear intent from commit messages
- Architectural decision needed
- Multiple valid interpretations

### When to Apply

- Business logic conflicts without context
- Architectural decisions conflict
- Different teams own branches
- Conflicting product requirements
- Unclear intent despite investigation

### Process

1. Document both approaches clearly
2. List assumptions and implications
3. Identify what information is needed
4. Ask specific questions
5. Get decision from appropriate stakeholder

### Example

```python
# Conflict in pricing logic
# CURRENT (billing-team): Customer-based tiers
def calculate_discount(customer_type: str) -> float:
    tiers = {'premium': 0.10, 'vip': 0.20}
    return tiers.get(customer_type, 0)

# INCOMING (operations-team): Amount-based tiers
def calculate_discount(amount: float) -> float:
    if amount > 1000:
        return 0.15
    elif amount > 500:
        return 0.10
    return 0

# QUESTION FOR PRODUCT: Should discount be based on customer type,
# order amount, or both?
```

### Documentation Template

```markdown
## Conflict Escalation: calculate_discount()

### Current Branch Approach
**Team**: Billing
**Logic**: Customer type tier system
**Rationale**: Rewards loyal customers with fixed discounts
**Impact**: Simpler logic, predictable customer costs

### Incoming Branch Approach
**Team**: Operations
**Logic**: Order amount tier system
**Rationale**: Higher order values get bulk discounts
**Impact**: Incentivizes larger orders, varied pricing

### Questions for Product
1. What is the primary discount driver: customer loyalty or order size?
2. Should both factors apply (customer AND amount)?
3. If both apply, which has priority?
4. Are there existing customers with discount contracts?

### Recommendation Pending
Decision needed from Product Manager before resolution.
```

### Pros
- Avoids making wrong decision
- Gets proper stakeholder input
- Creates opportunity for discussion
- Documents decision rationale
- Prevents future conflicts

### Cons
- Blocks merge resolution
- Requires external input
- Can cause delays
- Creates process overhead

---

## Strategy Selection Decision Tree

```
Conflict Type?

Formatting/Whitespace/Imports Only?
├─ YES → Strategy 1 or 2 (pick cleaner)
└─ NO → Continue

Can both changes coexist?
├─ YES → Go to "Both Valuable?"
│       ├─ YES → Strategy 3 (Merge Both)
│       └─ NO → Continue
└─ NO → Continue

Is one version clearly better?
├─ YES → Go to "Which is better?"
│       ├─ CURRENT → Strategy 1 (Accept Current)
│       └─ INCOMING → Strategy 2 (Accept Incoming)
└─ NO → Continue

Does refactoring solve the conflict?
├─ YES → Strategy 4 (Refactor)
└─ NO → Strategy 5 (Escalate to Team)
```

---

## Summary Table

| Strategy | Complexity | Risk | Testing | Use Case |
|----------|-----------|------|---------|----------|
| Accept Current | Low | Low | Basic | Current is better |
| Accept Incoming | Low | Low | Basic | Incoming is better |
| Manual Merge | High | High | Extensive | Both valuable |
| Refactor | Medium | Medium | Comprehensive | Design improvement |
| Escalate | Medium | Low | None | Unclear intent |

---

## Best Practices

1. **Always understand intent** - Read git log, commit messages, PRs
2. **Never guess** - Ask user if uncertain
3. **Test thoroughly** - Merged code must work correctly
4. **Document decisions** - Explain why in commit message
5. **Preserve both intents** - If both are valuable, merge them
6. **Automate formatting** - Use tools for trivial conflicts
7. **Create focused tests** - Tests should validate resolution
8. **Review carefully** - Have teammate review complex resolutions
