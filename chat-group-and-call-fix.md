# chat-group-and-call-fix.md

## Goal
Restrict group creation to admins only and ensure voice/video calls work perfectly in group chats.

## Tasks
- [ ] Phase 1: Group Creation Restriction
    - [ ] Modify `NewChatDialog.tsx` to prevent non-admin users from selecting more than one participant.
    - [ ] Add a visual cue (tooltip or message) in `NewChatDialog.tsx` explaining that only admins can create groups.
    - [ ] Update `handleNext` to enforce the `isAdmin` check before moving to the 'details' step.
- [ ] Phase 2: Group Call Optimization
    - [ ] Review `ChatWindow.tsx` `handleCall` logic.
    - [ ] Ensure `CallScreen` supports multiple participants for group calls (verification of existing UI).
    - [ ] Fix the global `igo-call-start` event detail to include group metadata if applicable.
- [ ] Phase 3: Verification
    - [ ] Verify non-admin cannot create groups.
    - [ ] Verify admin can create groups.
    - [ ] Verify group call (voice/video) starts for all participants.

## Done When
- [ ] Only admins can create group chats.
- [ ] Non-admins can only start direct (1-on-1) chats.
- [ ] Voice and video call buttons are functional in group chats.
- [ ] All group members receive the call invitation.
