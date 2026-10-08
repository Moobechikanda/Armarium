import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth-context';
import { Layout } from '@/components/Layout';
import { ProtectedRoute, AdminRoute } from '@/components/ProtectedRoute';
import { LandingPage } from '@/pages/LandingPage';
import { SignInPage } from '@/pages/SignInPage';
import { SignUpPage } from '@/pages/SignUpPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { CoursesPage, CreateCoursePage, CreateSchoolPage } from '@/pages/CoursesPage';
import { CreateProgrammePage } from '@/pages/CreateProgrammePage';
import { CourseDetailPage } from '@/pages/CourseDetailPage';
import { PaperDetailPage } from '@/pages/PaperDetailPage';
import { QuestionsPage } from '@/pages/QuestionsPage';
import { AiSolverPage } from '@/pages/AiSolverPage';
import { AdminImportPage } from '@/pages/AdminImportPage';
import { AdminUploadPage } from '@/pages/AdminUploadPage';
import { AdminReviewPage } from '@/pages/AdminReviewPage';
import { SearchPage } from '@/pages/SearchPage';
import { GroupsPage } from '@/pages/GroupsPage';
import { GroupDetailPage } from '@/pages/GroupDetailPage';
import { UploadMaterialsPage } from '@/pages/UploadMaterialsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/admin/login" element={<Navigate to="/signin" replace />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/courses/new" element={
              <ProtectedRoute><AdminRoute><CreateCoursePage /></AdminRoute></ProtectedRoute>
            } />
            <Route path="/schools/new" element={
              <ProtectedRoute><AdminRoute><CreateSchoolPage /></AdminRoute></ProtectedRoute>
            } />
            <Route path="/programmes/new" element={
              <ProtectedRoute><AdminRoute><CreateProgrammePage /></AdminRoute></ProtectedRoute>
            } />
            <Route path="/courses/:courseId" element={<CourseDetailPage />} />
            <Route path="/contribute" element={<ProtectedRoute><UploadMaterialsPage /></ProtectedRoute>} />
            <Route path="/groups" element={<ProtectedRoute><GroupsPage /></ProtectedRoute>} />
            <Route path="/groups/:groupId" element={<ProtectedRoute><GroupDetailPage /></ProtectedRoute>} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/admin/import" element={<ProtectedRoute><AdminRoute><AdminImportPage /></AdminRoute></ProtectedRoute>} />
            <Route path="/admin/upload" element={<ProtectedRoute><AdminRoute><AdminUploadPage /></AdminRoute></ProtectedRoute>} />
            <Route path="/admin/review" element={<ProtectedRoute><AdminRoute><AdminReviewPage /></AdminRoute></ProtectedRoute>} />
            <Route path="/papers/:paperId" element={<PaperDetailPage />} />
            <Route path="/ai-solver" element={<ProtectedRoute><AiSolverPage /></ProtectedRoute>} />
            <Route path="/questions" element={<QuestionsPage />} />
            <Route path="/dashboard" element={
              <ProtectedRoute><DashboardPage /></ProtectedRoute>
            } />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}
