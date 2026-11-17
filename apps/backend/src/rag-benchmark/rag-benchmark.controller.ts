import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsBoolean, IsOptional } from 'class-validator';
import { Public } from '../auth/decorators/public.decorator.js';
import { RagBenchmarkService } from './rag-benchmark.service.js';
import type {
  GoldenDatasetSummary,
  RagBenchmarkReport,
} from './rag-benchmark.types.js';

export class RunGoldenBenchmarkDto {
  @IsOptional()
  @IsBoolean()
  persistToDisk?: boolean;
}

@Controller('rag-benchmark')
export class RagBenchmarkController {
  constructor(private readonly ragBenchmarkService: RagBenchmarkService) {}

  @Public()
  @Get('dataset')
  getDataset(): GoldenDatasetSummary {
    return this.ragBenchmarkService.getDatasetSummary();
  }

  @Public()
  @Get('latest')
  getLatestReport(): RagBenchmarkReport {
    return (
      this.ragBenchmarkService.getLatestReport() ??
      this.ragBenchmarkService.runGoldenAblationBenchmark({
        persistToDisk: true,
      })
    );
  }

  @Public()
  @Post('run')
  runGoldenBenchmark(@Body() body?: RunGoldenBenchmarkDto): RagBenchmarkReport {
    return this.ragBenchmarkService.runGoldenAblationBenchmark({
      persistToDisk: body?.persistToDisk ?? true,
    });
  }
}
