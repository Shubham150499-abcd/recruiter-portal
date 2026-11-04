import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Profile from './pages/Profile.jsx';
import Jobs from './pages/Jobs.jsx';
import JobForm from './pages/JobForm.jsx';
import JobDetail from './pages/JobDetail.jsx';
import JobMatches from './pages/JobMatches.jsx';
import CandidateSearch from './pages/CandidateSearch.jsx';
import ResumeSearch from './pages/ResumeSearch.jsx';
import CandidateDetail from './pages/CandidateDetail.jsx';
import Shortlists from './pages/Shortlists.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/new" element={<JobForm />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/jobs/:id/edit" element={<JobForm />} />
        <Route path="/jobs/:id/matches" element={<JobMatches />} />
        <Route path="/search" element={<CandidateSearch />} />
        <Route path="/resume-search" element={<ResumeSearch />} />
        <Route path="/candidates/:id" element={<CandidateDetail />} />
        <Route path="/shortlists" element={<Shortlists />} />
        <Route path="*" element={<div className="card">Page not found.</div>} />
      </Route>
    </Routes>
  );
}
