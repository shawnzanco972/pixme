---
name: Creative Workshop
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#5b403f'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#8f6f6e'
  outline-variant: '#e4bebc'
  surface-tint: '#bb152c'
  primary: '#b7102a'
  on-primary: '#ffffff'
  primary-container: '#db313f'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb3b1'
  secondary: '#1d4ed8'
  on-secondary: '#ffffff'
  secondary-container: '#4069f2'
  on-secondary-container: '#fffbff'
  tertiary: '#745800'
  on-tertiary: '#ffffff'
  tertiary-container: '#926f00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad8'
  primary-fixed-dim: '#ffb3b1'
  on-primary-fixed: '#410007'
  on-primary-fixed-variant: '#92001c'
  secondary-fixed: '#dce1ff'
  secondary-fixed-dim: '#b7c4ff'
  on-secondary-fixed: '#001551'
  on-secondary-fixed-variant: '#0039b5'
  tertiary-fixed: '#ffdf98'
  tertiary-fixed-dim: '#f3bf2f'
  on-tertiary-fixed: '#251a00'
  on-tertiary-fixed-variant: '#5a4300'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Rubik
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Rubik
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Rubik
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
  headline-sm:
    fontFamily: Rubik
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Rubik
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.2'
  label-sm:
    fontFamily: Rubik
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  grid-margin: 24px
  gutter: 16px
  stack-xs: 4px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  stack-xl: 64px
---

## Brand & Style
The brand personality is energetic, imaginative, and tactile, designed to feel like a digital toy chest. It targets families, hobbyists, and children, evoking a sense of creative play and "clicking" things into place. 

The visual style is a hybrid of **Minimalism** and **Tactile/Skeuomorphism**. By utilizing clean, high-white-space layouts paired with components that mimic the physical properties of plastic building blocks, the UI feels both modern and toy-like. Surfaces should appear solid and physical, using subtle gradients and "stud" patterns to reinforce the brick-building metaphor without cluttering the user experience.

## Colors
This design system uses a high-vibrancy primary palette inspired by classic building blocks. 

- **Primary (Red):** Used for critical actions, branding elements, and celebratory moments.
- **Secondary (Blue):** Used for navigation, links, and secondary interactive elements.
- **Tertiary (Yellow):** Used for warnings, highlights, and "builder" tools to provide high contrast.
- **Backgrounds:** Keep surfaces clean using the neutral off-white to allow the "pixel art" content to remain the focus.
- **Success (Green):** A bright, friendly green for completion states and "Save" actions.

Avoid muddy tones or heavy grays; every color should feel "fresh out of the box."

## Typography
The typography is centered around **Rubik**, a font with slightly rounded corners that perfectly complements the "rounded-square" nature of building blocks. 

- **Headlines:** Use Rubik with heavier weights (Bold/Black) to create a "chunky," authoritative yet friendly feel.
- **Body Text:** **Plus Jakarta Sans** provides a clean, modern contrast with excellent legibility for instructions and descriptions.
- **Labels:** Use Rubik Medium for buttons and UI labels to maintain the playful character of the interface even at small sizes.

## Layout & Spacing
The layout follows a strict **8px grid system**, mirroring the mathematical precision of pixel art and toy bricks. 

- **Grid Model:** A 12-column fluid grid for desktop, collapsing to 4 columns on mobile. 
- **Consistency:** All margins and gutters should be multiples of 8. 
- **Touch Targets:** For a family-friendly design, ensure touch targets (buttons, inputs) are at least 48px high to accommodate younger users.
- **Safe Areas:** Maintain generous margins (24px+) around the main stage (the art canvas) to prevent accidental clicks while "building."

## Elevation & Depth
Depth is used to simulate physical objects. This design system avoids flat design in favor of "Soft Volume."

- **The "Click" Effect:** Use 2px-4px solid bottom borders (slightly darker than the surface color) on buttons and cards to create a 3D "extruded" look. When active/pressed, these elements should shift 2px down to simulate being pressed into a baseplate.
- **Shadows:** Use ambient, low-opacity shadows (Blur: 10px, Y: 4px, Color: 10% Opacity Black) to lift cards off the background.
- **Baseplate Layering:** The main workspace should appear slightly recessed, using a subtle inner shadow, while tools and panels should appear raised.

## Shapes
Shapes are defined by **Level 2 (Rounded)** settings. 

- **Components:** Standard buttons and cards use a 0.5rem (8px) radius. 
- **Containers:** Larger layout containers (like the art canvas or sidebars) use `rounded-xl` (1.5rem / 24px) to soften the overall appearance of the screen.
- **Interactive Elements:** Use "pill" shapes for chips and toggle switches to differentiate them from "block" elements.

## Components
Consistent component styling ensures the "workshop" feels unified.

- **Buttons:** Large, chunky, and colorful. Every button features a 3px "thickness" (border-bottom) that disappears on hover/active states. Use the primary Red for "Create" and Blue for "Next/Save."
- **Cards:** White backgrounds with a subtle gray outline and a `rounded-lg` radius. Cards should have a slight "pop" animation on hover.
- **Inputs:** Form fields use a thick 2px border in a light gray, turning Secondary Blue on focus. Use Rubik for placeholder text.
- **Chips/Filters:** Use bright yellow or blue backgrounds with high-contrast text. They should look like small, rounded brick studs.
- **Progress Bars:** Designed to look like a row of bricks filling up, with discrete segments rather than a smooth continuous fill.
- **The "Stud" Motif:** Use a subtle, repeating dot pattern (opacity 5%) on the main background to mimic a LEGO baseplate, providing visual texture without distracting from the UI.