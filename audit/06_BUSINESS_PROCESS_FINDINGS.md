# BUSINESS PROCESS FINDINGS - Heat Treatment Flow

## Expected Flow (from requirements):
Incoming Part → Planning Production → Heat Treatment → Quality Control → Shotblast (if needed) → Anti Rust (if needed) → Delivery

## Key Business Rules to Verify:
1. Control Number consistency across pages
2. QR Code linking
3. Process routing validation
4. Temperature tolerance (±15°C per DB)
5. Status transitions
6. QC approval chain (Inspector, Leader, Supervisor)
7. Prevention of skipping stages
8. Handling of optional processes (Shotblast/Anti Rust)
9. Delivery validation
10. Tracking history

## Observations from Codebase:

**BP-001 - Complex Status System (MEDIUM)**
- Multiple status representations
- Need to trace actual flow

**BP-002 - Temperature Validation Implemented (POSITIVE)**
- DB.validateTemperature() exists with ±15°C default
- Checks standard temperature from Part master
- Result OK only if within [min,max] inclusive

**BP-003 - QC Workflow (NEEDS VERIFICATION)**
- Has qc.html, leader-qc.html, supervisor-qc.html
- Has fields: inspector judgement, leader_judgement, supervisor_judgement
- Approval chain exists in schema

