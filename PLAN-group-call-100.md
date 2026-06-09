# PLAN-group-call-100.md

## Goal
Extend the group call functionality to support 100+ participants by refactoring the WebRTC implementation from a single-peer structure to a multi-peer (Mesh) topology, and optimizing the UI for large gatherings.

> **Note:** While we can remove the software limits, true 100+ participant support in a pure P2P Mesh network is limited by client bandwidth and CPU. We will implement optimizations to maximize capacity (e.g., audio-only defaults, pagination), but hardware limits will naturally apply around 10-20 active video streams.

## Tasks

### Phase 1: WebRTC Refactoring (Multi-Peer Support)
- [ ] Refactor `useWebRTC` to `useMultiWebRTC`.
    - [ ] Change `peerConnection` ref to `peerConnections` (`Map<string, RTCPeerConnection>`).
    - [ ] Change `remoteMediaStream` state to `remoteStreams` (`Map<string, MediaStream>`).
    - [ ] Update signaling logic (`handleSignal`) to identify `sender_id` and manage specific PCs.
    - [ ] Implement "Polite Peer" connection logic to handle collisions in a mesh.

### Phase 2: Call Screen UI Updates
- [ ] Update `CallScreen.tsx` to handle `remoteStreams` map.
- [ ] Implement a **Video Grid Layout** that adapts to the number of participants.
- [ ] Add **Pagination** or **Active Grid** logic (show top X participants).
- [ ] Add controls to "Mute All" or "Stop All Video" for bandwidth management.

### Phase 3: Scaling Optimizations
- [ ] Remove the "4 participant" warning in `ChatWindow.tsx`.
- [ ] Optimize `getMedia` constraints for large calls (lower bitrate/resolution by default).
- [ ] Implement audio-only mode toggle for performance.

## Verification
- [ ] Test with 3+ users to verify Mesh connectivity.
- [ ] Verify UI layout adapts to multiple video streams.
- [ ] Confirm no duplicate signals or connection loops.
