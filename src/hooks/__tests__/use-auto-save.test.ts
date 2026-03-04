import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutoSave } from "../use-auto-save";
import { SaveError } from "@/lib/save-error";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

import { toast } from "sonner";

describe("useAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultOpts = (overrides: Partial<Parameters<typeof useAutoSave>[0]> = {}) => ({
    onSave: vi.fn().mockResolvedValue(undefined),
    initialData: { name: "initial" },
    debounceMs: 500,
    ...overrides,
  });

  it("debounces: 3 rapid triggers produce 1 onSave call", async () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useAutoSave(opts));

    act(() => {
      result.current.trigger({ name: "a" });
      result.current.trigger({ name: "b" });
      result.current.trigger({ name: "c" });
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(opts.onSave).toHaveBeenCalledTimes(1);
    expect(opts.onSave).toHaveBeenCalledWith({ name: "c" });
  });

  it("success: status idle → saving → saved → idle", async () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useAutoSave(opts));

    expect(result.current.status).toBe("idle");

    act(() => result.current.trigger({ name: "test" }));
    await act(async () => vi.advanceTimersByTime(500));

    // After save resolves, status should be "saved"
    expect(result.current.status).toBe("saved");

    await act(async () => vi.advanceTimersByTime(3000));
    expect(result.current.status).toBe("idle");
  });

  it("non-retryable (400): immediate rollback, toast.error shown", async () => {
    const onRollback = vi.fn();
    const opts = defaultOpts({
      onSave: vi.fn().mockRejectedValue(new SaveError("Bad request", 400)),
      onRollback,
    });
    const { result } = renderHook(() => useAutoSave(opts));

    act(() => result.current.trigger({ name: "bad" }));
    await act(async () => vi.advanceTimersByTime(500));

    expect(result.current.status).toBe("error");
    expect(toast.error).toHaveBeenCalledWith("Bad request");
    expect(onRollback).toHaveBeenCalledWith({ name: "initial" }, "Bad request");
  });

  it("retryable (500) then success: status retrying, retry after 3s, no rollback", async () => {
    const onRollback = vi.fn();
    const onSave = vi.fn()
      .mockRejectedValueOnce(new SaveError("Server error", 500))
      .mockResolvedValueOnce(undefined);
    const opts = defaultOpts({ onSave, onRollback });
    const { result } = renderHook(() => useAutoSave(opts));

    act(() => result.current.trigger({ name: "retry-me" }));
    await act(async () => vi.advanceTimersByTime(500));

    expect(result.current.status).toBe("retrying");
    expect(onRollback).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTime(3000));

    expect(onSave).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("saved");
    expect(onRollback).not.toHaveBeenCalled();
  });

  it("retryable, retry also fails: rollback called after second failure", async () => {
    const onRollback = vi.fn();
    const onSave = vi.fn()
      .mockRejectedValueOnce(new SaveError("Server error", 500))
      .mockRejectedValueOnce(new SaveError("Server error", 500));
    const opts = defaultOpts({ onSave, onRollback });
    const { result } = renderHook(() => useAutoSave(opts));

    act(() => result.current.trigger({ name: "fail-twice" }));
    await act(async () => vi.advanceTimersByTime(500));

    expect(result.current.status).toBe("retrying");

    await act(async () => vi.advanceTimersByTime(3000));

    expect(onSave).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("error");
    expect(onRollback).toHaveBeenCalledWith({ name: "initial" }, "Server error");
    expect(toast.error).toHaveBeenCalledWith("Server error");
  });

  it("trigger during retry: cancels retry, restarts debounce", async () => {
    const onSave = vi.fn()
      .mockRejectedValueOnce(new SaveError("Server error", 500))
      .mockResolvedValueOnce(undefined);
    const opts = defaultOpts({ onSave });
    const { result } = renderHook(() => useAutoSave(opts));

    act(() => result.current.trigger({ name: "first" }));
    await act(async () => vi.advanceTimersByTime(500));

    expect(result.current.status).toBe("retrying");

    // Trigger new data during retry
    act(() => result.current.trigger({ name: "second" }));

    // Advance past what would have been the retry timer
    await act(async () => vi.advanceTimersByTime(500));

    // Should have called with "second", not retried "first"
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenLastCalledWith({ name: "second" });
  });

  it("flush: fires immediately, no retry on failure", async () => {
    const onRollback = vi.fn();
    const onSave = vi.fn().mockRejectedValue(new SaveError("err", 500));
    const opts = defaultOpts({ onSave, onRollback });
    const { result } = renderHook(() => useAutoSave(opts));

    act(() => result.current.trigger({ name: "flush-me" }));
    // Flush before debounce fires
    await act(async () => result.current.flush());

    expect(onSave).toHaveBeenCalledTimes(1);
    // Flush is best-effort: no rollback, no toast
    expect(onRollback).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("lastSavedRef updates: save success, then fail → rollback receives saved data", async () => {
    const onRollback = vi.fn();
    const onSave = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new SaveError("Nope", 400));
    const opts = defaultOpts({ onSave, onRollback });
    const { result } = renderHook(() => useAutoSave(opts));

    // First save succeeds
    act(() => result.current.trigger({ name: "saved-version" }));
    await act(async () => vi.advanceTimersByTime(500));
    expect(result.current.status).toBe("saved");

    // Second save fails
    act(() => result.current.trigger({ name: "failed-version" }));
    await act(async () => vi.advanceTimersByTime(500));

    expect(result.current.status).toBe("error");
    // Rollback should get the last successfully saved data, not initialData
    expect(onRollback).toHaveBeenCalledWith({ name: "saved-version" }, "Nope");
  });
});
