// After the owner taps Approve/Decline (or 48 h pass with no answer).
const before = $('Approval rule').first().json;
const r = ($input.first().json || {}).data || {};
const status = r.approved === true ? 'approved' : r.approved === false ? 'rejected' : 'expired_rejected';
return [{ json: { ...before, approval_status: status, approval_responded_at: r.respondedAt || new Date().toISOString() } }];
