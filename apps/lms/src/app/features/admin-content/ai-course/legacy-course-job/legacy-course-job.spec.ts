import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { envelopeOk } from '@lms/mocks';
import { of } from 'rxjs';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../../core/config/app-config';
import { testAppConfig } from '../../../../core/config/app-config.testing';
import { provideEnvelopeHttpClient } from '../../../../core/http/http.testing';
import { LegacyCourseJob } from './legacy-course-job';

const URL = '/api/v1/assistant/course-jobs/5';

const job = (courseId: number | null) => ({
  jobId: 5,
  status: 'completed',
  step: 'draft',
  progress: 100,
  inputs: {
    programmeId: 1,
    competencyId: 2,
    targetLearners: 'Nhân viên mới',
    level: 'BEGINNER',
  },
  ownerOrgId: 1,
  courseId,
  steps: [],
  createTime: '2026-11-11T10:00:00+07:00',
  updateTime: '2026-11-11T10:05:00+07:00',
});

async function settle(): Promise<void> {
  TestBed.tick();
  await Promise.resolve();
  TestBed.tick();
  await Promise.resolve();
}

describe('LegacyCourseJob', () => {
  let backend: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideEnvelopeHttpClient(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ jobId: '5' })) },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    navigate = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);
  });

  afterEach(() => backend.verify());

  async function open(courseId: number | null) {
    const fixture = TestBed.createComponent(LegacyCourseJob);
    fixture.detectChanges();
    await settle();
    backend.expectOne(URL).flush(envelopeOk(job(courseId)));
    await settle();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('sends a job that has a course to that course in the editor, replacing the old link', async () => {
    await open(42);

    expect(navigate).toHaveBeenCalledWith('/admin/courses/42/edit', {
      replaceUrl: true,
    });
  });

  it('says a job without a course belongs to the old flow and goes nowhere', async () => {
    const el = await open(null);

    expect(el.textContent).toContain('Job này thuộc luồng cũ');
    expect(navigate).not.toHaveBeenCalled();
  });
});
