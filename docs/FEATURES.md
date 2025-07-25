# Classroom Widgets Features

Comprehensive list of features available in the Classroom Widgets application.

## 🎯 Core Features

### Session Management
- **Single Session Code**: One 5-character code works for all activities
- **Multi-Widget Sessions**: Run multiple activities simultaneously
- **Auto-Join**: Students automatically see new activities when teacher creates them
- **Session Persistence**: Rejoin sessions after connection loss
- **Real-time Sync**: Instant updates across all connected devices

### Workspace Management
- **Drag & Drop**: Position widgets anywhere on the 3000x2000 canvas
- **Resize Controls**: Adjust widget sizes with optional aspect ratio lock
- **Auto-Save**: Workspace layout and widget states persist automatically
- **Zoom Controls**: Pinch-to-zoom (0.5x - 2x) with focal point preservation
- **Background Options**: Geometric patterns, gradients, lines, dots, or plain
- **Dark Mode**: System-aware theme switching

## 🧩 Available Widgets

### Interactive Widgets (Networked)

#### Poll
- Real-time voting with instant results
- Multiple choice questions (2-10 options)
- Live vote counter
- Results visualization with bar charts
- Start/pause voting control
- Anonymous voting

#### Questions
- Student Q&A submission system
- Mark questions as answered
- Delete individual questions
- Clear all questions
- Shows student names with submissions
- Pause/resume accepting questions

#### Link Share (formerly Data Share)
- Collect links from students
- Display all submissions in real-time
- Open links in new tabs
- Remove individual submissions
- Clear all submissions
- Automatic link validation

#### RT Feedback (Real-Time Feedback)
- 5-point scale feedback collection
- Live average calculation
- Distribution visualization
- Labels: "Too Easy" to "Too Hard"
- Pause/resume feedback collection
- Reset functionality

### Utility Widgets

#### Timer
- Countdown timer with preset durations
- Custom time input
- Stopwatch mode
- Visual progress indicator
- Sound notification on completion
- Pause/resume functionality

#### Randomiser
- Random selection from list
- Dual-column interface (active/removed)
- Colorful slot machine animation
- Confetti celebration effect
- Real-time list processing
- Adaptive animation speed

#### List
- Task management with checkboxes
- Add/remove items
- Mark items complete
- Confetti trigger button
- Reorder items
- Clear completed items

#### Task Cue
- Visual work mode indicators
- Three states: Solo, Pair, Group
- Large, clear icons
- Quick toggle between modes

#### Traffic Light
- Three-state status indicator
- Red, amber, green lights
- Click to cycle through states
- Clear visual feedback

### Display Widgets

#### Text Banner
- Customizable text display
- Adjustable font size
- Text alignment options
- Color customization
- Multi-line support

#### Image Display
- Drag-and-drop image upload
- URL image loading
- Maintain aspect ratio
- Full widget image display
- Supports common formats (PNG, JPG, GIF)

#### QR Code
- Generate QR codes from text/URLs
- Automatic sizing
- High contrast display
- Instant generation

#### Sound Effects
- Pre-loaded sound library
- One-click playback
- Visual play indicators
- No overlapping sounds

#### Sticker
- Decorative sticker library
- Various categories
- Click to place
- Visual enhancement

### Utility Widgets

#### Seating Chart
- Visual classroom layout
- Drag students to seats
- Random seat assignment
- Save/load configurations

#### Drawing Board
- Free-hand drawing
- Color selection
- Brush size options
- Clear canvas
- Undo/redo

#### Scoreboard
- Multi-team scoring
- Add/subtract points
- Reset scores
- Visual indicators

## 🎨 UI/UX Features

### Teacher Interface
- **Toolbar Customization**: Choose which widgets to display
- **Widget Icons**: Visual widget identification in headers
- **Session Banner**: Expandable session info with copy buttons
- **Connection Status**: WiFi icon with real-time server status
- **Integrated Clock**: Current time display with blinking colon
- **Trash Zone**: Drag widgets to delete with 1.5s hover delay

### Student Interface
- **Responsive Design**: Optimized for phones, tablets, and desktops
- **Connection Indicator**: Unified header status display
- **Activity Cards**: Color-coded by widget type
- **Minimize Controls**: Collapse activities to save space
- **Dark Mode**: Matches system preferences
- **Auto-Scroll**: Header becomes compact when scrolling

### Visual Design
- **Consistent Color Scheme**:
  - Sage (green): Active/positive actions
  - Dusty Rose (red): Stop/negative actions
  - Terracotta (orange): Secondary actions
  - Warm Gray: Neutral elements
- **Smooth Animations**: Transitions and state changes
- **Loading States**: Clear feedback during operations
- **Error Messages**: User-friendly error displays

## 🔧 Technical Features

### Performance
- **Lazy Loading**: Widgets load on-demand
- **Optimized Rendering**: Efficient React component updates
- **Debounced Updates**: Prevent excessive server calls
- **Resource Management**: Automatic cleanup on unmount

### Reliability
- **Auto-Reconnection**: Handles network interruptions
- **State Persistence**: Survives page refreshes
- **Error Recovery**: Graceful handling of failures
- **Session Cleanup**: Automatic after 12 hours

### Security
- **No Account Required**: Anonymous usage
- **Session Isolation**: Activities are private to session
- **Input Validation**: Server-side validation
- **XSS Protection**: Sanitized user inputs

## 📱 Platform Support

### Browsers
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Devices
- Desktop computers
- Tablets (iPad, Android)
- Smartphones
- Interactive whiteboards

### Operating Systems
- Windows 10/11
- macOS 10.15+
- iOS 14+
- Android 8+
- Linux (Ubuntu, Fedora)

## 🚀 Deployment Options

### Cloud Deployment
- Docker containerization
- Nginx reverse proxy
- SSL/TLS support
- Environment configuration

### Local Deployment
- Development server
- Local network access
- Hot module replacement
- Debug capabilities

## 📊 Usage Scenarios

### Classroom Activities
- Quick polls and surveys
- Exit tickets
- Brainstorming sessions
- Understanding checks
- Group discussions

### Remote Learning
- Synchronous engagement
- Asynchronous submissions
- Hybrid classroom support
- Breakout activities

### Professional Development
- Workshop activities
- Training feedback
- Team building
- Meeting engagement