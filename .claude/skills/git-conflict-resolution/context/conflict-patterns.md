# Git Conflict Patterns

## Common Conflict Types

### 1. Formatting Conflicts

**Pattern**: Different formatting (black, prettier, autopep8)

**Example**:
```python
# Current branch (main)
def process_data(items: list[str],
                 config: dict,
                 timeout: int = 30) -> dict:
    """Process data with config."""
    result = {}
    for item in items:
        result[item] = apply_config(item, config)
    return result

# Incoming branch (feature)
def process_data(
    items: list[str], config: dict, timeout: int = 30
) -> dict:
    """Process data with config."""
    result = {}
    for item in items:
        result[item] = apply_config(item, config)
    return result
```

**Resolution**: Accept either format (prefer project's formatter standard)

**Safety**: TRIVIAL - Same logic, just formatting

**Anti-pattern**: Manually choosing lines instead of applying formatter consistently

---

### 2. Import Order Conflicts

**Pattern**: Different import ordering (isort, autoflake)

**Example**:
```python
# Current branch
import sys
from typing import Optional, Dict, List
from pathlib import Path
import json

# Incoming branch
from pathlib import Path
import json
import sys
from typing import Dict, List, Optional
```

**Resolution**: Apply isort or project's import formatter

**Safety**: TRIVIAL - Import order doesn't affect logic

**Anti-pattern**: Manually ordering instead of using tool

---

### 3. Method Signature Changes

**Pattern**: Changing method signature with updates needed in callers

**Example**:
```python
# Current branch (adds parameter)
def fetch_user(user_id: int, include_profile: bool = False) -> dict:
    # ...

# Incoming branch (different approach)
def fetch_user(user_id: int) -> dict:
    # ...
```

**Resolution Steps**:
1. Check all callers in both branches
2. Decide: Keep current signature? Use incoming? Merge both?
3. Update all call sites consistently
4. Test all modified call paths

**Safety**: MODERATE - Requires checking all usages

**Anti-pattern**: Changing signature without updating all callers

---

### 4. Variable Rename Conflicts

**Pattern**: Same variable renamed differently in two branches

**Example**:
```python
# Current branch
user_dict = fetch_user(user_id)
if user_dict['status'] == 'active':
    process_user(user_dict)

# Incoming branch
user_data = fetch_user(user_id)
if user_data['status'] == 'active':
    process_user(user_data)
```

**Resolution**:
1. Choose most semantic name
2. Apply rename consistently across branch
3. Update all references
4. Test functionality

**Safety**: MODERATE - Easy to introduce typos

**Anti-pattern**: Renaming in conflict area but missing other usages

---

### 5. Business Logic Conflicts

**Pattern**: Conflicting business logic implementations

**Example**:
```python
# Current branch (new validation)
def calculate_discount(amount: float, customer_type: str) -> float:
    if customer_type == 'premium':
        return amount * 0.10
    elif customer_type == 'vip':
        return amount * 0.20
    return 0

# Incoming branch (tiered by amount)
def calculate_discount(amount: float, customer_type: str) -> float:
    if amount > 1000:
        return amount * 0.15
    elif amount > 500:
        return amount * 0.10
    return 0
```

**Resolution Options**:
1. **Option A**: Keep current (customer-based tiers)
2. **Option B**: Accept incoming (amount-based tiers)
3. **Option C**: Merge both (customer AND amount thresholds)

**Safety**: COMPLEX - Requires business understanding

**Requirements Analysis**:
- What is the business requirement?
- Which approach aligns with product roadmap?
- Do we need both logic combined?
- Impact on pricing, revenue, customer satisfaction?

**Anti-pattern**: Choosing randomly or keeping both without merging properly

---

### 6. Data Model Conflicts

**Pattern**: Conflicting schema or data structure changes

**Example**:
```python
# Current branch
class User:
    def __init__(self, name: str, email: str):
        self.name = name
        self.email = email
        self.email_verified = False  # NEW

# Incoming branch
class User:
    def __init__(self, name: str, email: str):
        self.name = name
        self.email = email
        self.last_login = None  # NEW
```

**Resolution**:
1. Determine if both fields needed
2. Merge all new fields
3. Create data migration if in database
4. Update all constructor calls
5. Test serialization/deserialization

**Safety**: COMPLEX - Requires schema understanding

**Migration Considerations**:
- Backwards compatibility?
- Database migration needed?
- API version changes?
- Client app updates?

---

### 7. Configuration Conflicts

**Pattern**: Different configuration value changes

**Example**:
```python
# Current branch
TIMEOUT = 60
RETRY_COUNT = 5

# Incoming branch
TIMEOUT = 30
RETRY_COUNT = 3
```

**Resolution**:
1. Understand why values changed in each branch
2. Choose most appropriate values
3. Consider combining with feature flags
4. Document rationale in commit

**Safety**: MODERATE - Depends on impact

**Best Practice**: Use feature flags for independent config changes

---

### 8. Dependency Version Conflicts

**Pattern**: Different versions specified for same dependency

**Example**:
```
# Current branch
requests==2.31.0
Django==4.2.0

# Incoming branch
requests==2.28.0
Django==4.1.0
```

**Resolution**:
1. Check compatibility between versions
2. Test with each version
3. Consider security updates
4. Prefer newer stable versions
5. Document version pins

**Safety**: COMPLEX - Version compatibility issues

**Best Practice**: Use compatible version ranges (>=, <) rather than pins

---

## Language-Specific Patterns

### Python

**Import Statement Conflicts**: Very common with isort
- Use `isort .` to normalize all files before resolving

**Type Hint Conflicts**: Different Optional/Union syntax
- Prefer newer PEP 604 syntax (A | B) for Python 3.10+

**Decorator Conflicts**: Often formatting issues
- Check if decorators match functionality

### JavaScript/TypeScript

**Import/Export Conflicts**: Different module systems
- Verify consistent use of CommonJS or ES modules

**Prettier Formatting**: Common formatting conflicts
- Use `prettier --write` to normalize

**Type Definition Conflicts**: Interface or type changes
- Merge interfaces when both add different fields

---

## Anti-Patterns to Avoid

1. **Manually choosing lines**: Use formatter tools instead
2. **Renaming without full scope**: Update all usages
3. **Business logic guessing**: Ask user for intent
4. **Ignoring test breakage**: Tests should validate resolution
5. **Not documenting**: Always explain reasoning
6. **Forgetting edge cases**: Consider both branches' behaviors
7. **Incomplete merges**: Don't choose one branch entirely if both have value
8. **Skipping validation**: Always test merged result

---

## Resolution Decision Tree

```
Is it formatting/whitespace/import order only?
├─ YES → Auto-resolve (trivial)
└─ NO → Continue

Is it a simple rename or method signature change?
├─ YES → Suggest resolution with update scope (moderate)
└─ NO → Continue

Can both changes coexist?
├─ YES → Suggest merging both with validation (moderate)
└─ NO → Continue

Do you understand the business logic intent?
├─ YES → Suggest option with reasoning (moderate/complex)
└─ NO → Ask user for clarification (complex, stop)
```

---

## Testing Strategy

For each conflict resolution:

1. **Trivial**: Verify no functional change
2. **Moderate**: Write tests for both original approaches
3. **Complex**: Create comprehensive tests covering both intents

Example test pattern:
```python
def test_conflict_resolution_preserves_current_behavior():
    """Verify merged code has current branch's behavior."""
    assert calculate_discount(1500, 'premium') == 150  # Current logic

def test_conflict_resolution_preserves_incoming_behavior():
    """Verify merged code has incoming branch's behavior."""
    assert calculate_discount(1500, 'premium') == 225  # Incoming logic

def test_conflict_resolution_both_behaviors():
    """Verify merged code combines both approaches."""
    assert calculate_discount(1500, 'premium') > 150  # Both applied
```
