# AI Job Finder - Quality Validation Test Suite

## Test Queries

### Marketing Roles
1. **Query**: `marketing manager job Kuwait`
   - **Expected**: Marketing manager positions from Bayt/LinkedIn/Indeed
   - **Should NOT return**: IT/tech roles, cybersecurity positions

2. **Query**: `digital marketing specialist Kuwait`
   - **Expected**: Digital marketing, social media, content marketing roles
   - **Should NOT return**: Software development, data analyst positions

3. **Query**: `fresh graduate marketing jobs Kuwait City`
   - **Expected**: Entry-level marketing positions, junior roles, internships
   - **Should NOT return**: Senior positions, unrelated fields

### IT & Tech Roles
4. **Query**: `software engineer Kuwait`
   - **Expected**: Software developer, backend developer, full stack positions
   - **Should NOT return**: Marketing, sales, or HR roles

5. **Query**: `cybersecurity analyst job Kuwait`
   - **Expected**: Cybersecurity, information security, SOC analyst positions
   - **Should NOT return**: Marketing jobs, unrelated IT roles

6. **Query**: `entry level SOC analyst Kuwait`
   - **Expected**: Junior security operations center roles, entry-level cybersecurity
   - **Should NOT return**: Senior positions, marketing roles

7. **Query**: `IT support technician jobs in Kuwait`
   - **Expected**: IT support, help desk, technical support positions
   - **Should NOT return**: Software development, marketing roles

8. **Query**: `data analyst job Kuwait`
   - **Expected**: Data analyst, business analyst, data scientist positions
   - **Should NOT return**: Marketing, software development (unless data-focused)

### Specialized Roles
9. **Query**: `QA tester Kuwait`
   - **Expected**: Quality assurance, software testing, QA engineer positions
   - **Should NOT return**: Marketing, general IT support

10. **Query**: `project manager IT Kuwait`
    - **Expected**: IT project manager, technical project manager positions
    - **Should NOT return**: Non-IT project managers, marketing roles

### Entry Level / Junior
11. **Query**: `junior software developer Kuwait`
    - **Expected**: Entry-level developer positions, graduate programs
    - **Should NOT return**: Senior roles, marketing positions

12. **Query**: `fresh graduate computer science Kuwait`
    - **Expected**: Graduate programs, trainee positions, junior tech roles
    - **Should NOT return**: Experienced roles, unrelated fields

### Arabic Queries
13. **Query**: `وظائف تسويق في الكويت`
    - **Expected**: Marketing jobs in Kuwait (Arabic results)
    - **Should NOT return**: Tech roles, unrelated fields

14. **Query**: `مهندس برمجيات الكويت`
    - **Expected**: Software engineer jobs (Arabic results)
    - **Should NOT return**: Marketing, non-tech roles

## Validation Checklist

For each query, verify:

- [ ] **Results returned** (not empty unless legitimately no matches)
- [ ] **Role relevance**: Jobs match the requested role/field
- [ ] **Recency**: Jobs posted within last 30 days (check `postedAt` field)
- [ ] **Source diversity**: Mix of Bayt, LinkedIn, and/or Indeed
- [ ] **No cross-contamination**: Marketing queries don't return tech jobs and vice versa
- [ ] **Company extracted**: Most results have `company` field populated
- [ ] **Location**: Results mention Kuwait or Kuwait City
- [ ] **No expired jobs**: Check for "closed" or "expired" indicators
- [ ] **Error handling**: Empty results show helpful guidance message

## Success Criteria

✅ **Pass**: 10+ out of 14 queries return relevant, recent jobs  
⚠️ **Warning**: 7-9 queries return relevant results (needs tuning)  
❌ **Fail**: <7 queries return relevant results (major issues)

## Known Limitations

- Niche roles (e.g., blockchain, AI/ML) may have limited results due to Kuwait market
- Arabic queries may have fewer results if job boards use English primarily
- Some listing pages may appear if individual postings are scarce

## Testing Instructions

1. Open the AI Job Finder interface
2. Enter each test query
3. Review results for relevance and recency
4. Check browser console for `[job-search]` logs
5. Document any failures or unexpected results

## Last Updated
October 20, 2025
