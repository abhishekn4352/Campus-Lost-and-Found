import { Component } from 'react';
import { ErrorState } from './States';

// Last line of defence: a render error in one screen shows a recoverable
// message instead of a blank white page.
export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('UI error:', error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="container page">
        <ErrorState message="An unexpected error occurred. Reloading usually fixes it." onRetry={() => window.location.reload()} />
      </div>
    );
  }
}
