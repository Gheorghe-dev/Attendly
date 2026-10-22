describe('Device Collision Anti-Proxy Logic', () => {
  it('detects when the same device tries to register two different students in the same session', () => {
    interface Record {
      sessionId: string;
      studentId: string;
      deviceId: string;
      deviceFingerprint?: string;
    }

    const records: Record[] = [
      {
        sessionId: 'sess_1',
        studentId: 'student_A',
        deviceId: 'device_iphone_123',
        deviceFingerprint: 'fp_hash_abc',
      },
    ];

    function checkDeviceAllowed(newRecord: Record): { allowed: boolean; reason?: string } {
      const collision = records.find(
        (r) =>
          r.sessionId === newRecord.sessionId &&
          r.studentId !== newRecord.studentId &&
          r.deviceId === newRecord.deviceId
      );
      if (collision) {
        return { allowed: false, reason: 'DEVICE_ALREADY_USED' };
      }
      return { allowed: true };
    }

    // 1. Same student re-scanning with same phone -> ALLOWED
    const sameStudent = checkDeviceAllowed({
      sessionId: 'sess_1',
      studentId: 'student_A',
      deviceId: 'device_iphone_123',
      deviceFingerprint: 'fp_hash_abc',
    });
    expect(sameStudent.allowed).toBe(true);

    // 2. Different student scanning with SAME phone in SAME session -> REJECTED
    const proxyAttempt = checkDeviceAllowed({
      sessionId: 'sess_1',
      studentId: 'student_B',
      deviceId: 'device_iphone_123',
      deviceFingerprint: 'fp_hash_abc',
    });
    expect(proxyAttempt.allowed).toBe(false);
    expect(proxyAttempt.reason).toBe('DEVICE_ALREADY_USED');

    // 3. Different student with different phone (even if phone model / hardware fingerprint matches) -> ALLOWED
    const validStudent = checkDeviceAllowed({
      sessionId: 'sess_1',
      studentId: 'student_B',
      deviceId: 'device_iphone_456',
      deviceFingerprint: 'fp_hash_abc',
    });
    expect(validStudent.allowed).toBe(true);

    // 4. Same phone in a DIFFERENT session tomorrow -> ALLOWED
    const nextDaySession = checkDeviceAllowed({
      sessionId: 'sess_2',
      studentId: 'student_B',
      deviceId: 'device_iphone_123',
      deviceFingerprint: 'fp_hash_abc',
    });
    expect(nextDaySession.allowed).toBe(true);
  });
});
