"use client";

import { useState } from "react";
import type { CandidateResult } from "@/types/assignment";

interface AssignmentCandidatesProps {
  className?: string;
}

export default function AssignmentCandidates({ className = "" }: AssignmentCandidatesProps) {
  const [bookingId, setBookingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    status: string;
    interpreterId?: string;
    reason?: string;
    note?: string;
    breakdown?: Array<{
      interpreterId: string;
      empCode: string;
      currentHours: number;
      daysSinceLastAssignment: number;
      scores: { fairness: number; urgency: number; lrs: number; total: number };
      eligible: boolean;
      reason?: string;
    }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAssignment = async () => {
    if (!bookingId.trim()) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch("/api/assignment/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: parseInt(bookingId) }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.error || "Failed to run assignment");
      }
    } catch (error) {
      setError("Error running assignment");
    } finally {
      setLoading(false);
    }
  };

  const formatScore = (score: number) => score.toFixed(3);
  const formatHours = (hours: number) => hours.toFixed(1);

  return (
    <div className={`p-6 bg-white rounded-lg shadow ${className}`}>
      <h2 className="text-xl font-semibold mb-6">Assignment Diagnostic Panel</h2>
      
      {/* Input Section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Booking ID
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            placeholder="Enter booking ID"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={runAssignment}
            disabled={loading || !bookingId.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? "Running..." : "Run Assignment"}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">
          {error}
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="space-y-4">
          {/* Status Summary */}
          <div className={`p-4 rounded-lg ${
            result.status === "assigned" 
              ? "bg-green-100 text-green-800" 
              : "bg-yellow-100 text-yellow-800"
          }`}>
            <h3 className="font-semibold mb-2">
              Status: {result.status === "assigned" ? "✅ Assigned" : "⚠️ Escalated"}
            </h3>
            {result.interpreterId && (
              <p className="text-sm">
                <strong>Interpreter:</strong> {result.interpreterId}
              </p>
            )}
            {result.reason && (
              <p className="text-sm">
                <strong>Reason:</strong> {result.reason}
              </p>
            )}
            {result.note && (
              <p className="text-sm">
                <strong>Note:</strong> {result.note}
              </p>
            )}
          </div>

          {/* Candidate Breakdown */}
          {result.breakdown && result.breakdown.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Candidate Analysis</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Interpreter
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Current Hours
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Days Since Last
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fairness
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Urgency
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        LRS
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Score
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {result.breakdown.map((candidate: CandidateResult, index: number) => (
                      <tr key={candidate.interpreterId} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-3 py-2 text-sm font-medium text-gray-900">
                          {candidate.empCode}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-500">
                          {formatHours(candidate.currentHours)}h
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-500">
                          {candidate.daysSinceLastAssignment === Infinity 
                            ? "Never" 
                            : `${candidate.daysSinceLastAssignment.toFixed(1)}d`
                          }
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-500">
                          {formatScore(candidate.scores.fairness)}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-500">
                          {formatScore(candidate.scores.urgency)}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-500">
                          {formatScore(candidate.scores.lrs)}
                        </td>
                        <td className="px-3 py-2 text-sm font-medium text-gray-900">
                          {formatScore(candidate.scores.total)}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            candidate.eligible
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}>
                            {candidate.eligible ? "Eligible" : "Ineligible"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Ineligible Reasons */}
              {result.breakdown.some((c: CandidateResult) => !c.eligible && c.reason) && (
                <div className="mt-4 p-3 bg-gray-100 rounded">
                  <h4 className="font-medium mb-2">Ineligible Reasons:</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {result.breakdown
                      .filter((c: CandidateResult) => !c.eligible && c.reason)
                      .map((c: CandidateResult) => (
                        <li key={c.interpreterId}>
                          <strong>{c.empCode}:</strong> {c.reason}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">How to use:</h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Enter a booking ID that doesn not have an interpreter assigned</li>
          <li>Click Run Assignment to see the auto-assignment process</li>
          <li>Review the candidate scores and eligibility</li>
          <li>Check the assignment log for detailed decision history</li>
        </ol>
      </div>
    </div>
  );
}
