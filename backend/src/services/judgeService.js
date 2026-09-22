import { executionService } from "./executionService.js";

export class JudgeService {
  async execute(code, testCases, language, options = {}) {
    return executionService.execute(code, testCases, language, options);
  }
}

const judgeService = new JudgeService();

export { judgeService };

