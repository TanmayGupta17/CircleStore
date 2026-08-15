/**
 * Seed data.
 *
 * Everything here is DECLARATIVE — categories, fields and attachments are plain
 * data, which is the entire thesis of the project: this file adds three
 * categories and twenty fields without touching a line of application code.
 *
 * Listings are created through the real schema engine (resolve -> validate ->
 * snapshot) rather than by writing JSON straight into the column, so the seed
 * doubles as an end-to-end check that the engine works.
 */

import { PrismaClient } from '@prisma/client';
import { resolveFormSchema } from '../src/core/schema/resolver';
import { buildSnapshot } from '../src/core/schema/snapshot';
import { hasErrors, validateAttributes } from '../src/core/schema/validator';
import type { FieldType, ListingCondition, VisibilityRule } from '../src/core/types';
import { slugify } from '../src/utils/slug';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

interface CategorySeed {
  key: string;
  name: string;
  icon: string;
  description: string;
  parent?: string;
  sortOrder: number;
}

/**
 * The category tree.
 *
 * Parents group and share fields; only LEAF categories accept listings. This
 * list is data — an admin adds "Drone" or "Sewing Machine" through the UI
 * without an engineer touching anything.
 *
 * `everything-else` is the deliberate escape hatch: a seller whose item fits no
 * category can still list it, so nothing on the marketplace is unsellable.
 */
const CATEGORIES: CategorySeed[] = [
  // --- Electronics ---
  { key: 'electronics', name: 'Electronics', icon: '🔌', description: 'Phones, computers and gadgets', sortOrder: 0 },
  { key: 'mobile-phone', name: 'Mobile Phone', icon: '📱', description: 'Smartphones and feature phones', parent: 'electronics', sortOrder: 1 },
  { key: 'laptop', name: 'Laptop', icon: '💻', description: 'Notebooks and ultrabooks', parent: 'electronics', sortOrder: 2 },
  { key: 'tablet', name: 'Tablet', icon: '📲', description: 'Tablets and e-readers', parent: 'electronics', sortOrder: 3 },
  { key: 'television', name: 'Television', icon: '📺', description: 'Smart TVs and monitors', parent: 'electronics', sortOrder: 4 },
  { key: 'camera', name: 'Camera', icon: '📷', description: 'DSLRs, mirrorless and lenses', parent: 'electronics', sortOrder: 5 },
  { key: 'headphones', name: 'Headphones & Audio', icon: '🎧', description: 'Headphones, earbuds and speakers', parent: 'electronics', sortOrder: 6 },
  { key: 'gaming-console', name: 'Gaming Console', icon: '🎮', description: 'Consoles and handhelds', parent: 'electronics', sortOrder: 7 },
  { key: 'smartwatch', name: 'Smartwatch', icon: '⌚', description: 'Smartwatches and fitness bands', parent: 'electronics', sortOrder: 8 },

  // --- Home appliances ---
  { key: 'appliances', name: 'Home Appliances', icon: '🏠', description: 'Large and small appliances', sortOrder: 10 },
  { key: 'refrigerator', name: 'Refrigerator', icon: '🧊', description: 'Fridges and freezers', parent: 'appliances', sortOrder: 11 },
  { key: 'washing-machine', name: 'Washing Machine', icon: '🌀', description: 'Washers and dryers', parent: 'appliances', sortOrder: 12 },
  { key: 'air-conditioner', name: 'Air Conditioner', icon: '❄️', description: 'Split, window and portable ACs', parent: 'appliances', sortOrder: 13 },
  { key: 'kitchen-appliance', name: 'Kitchen Appliance', icon: '🍳', description: 'Microwaves, mixers and ovens', parent: 'appliances', sortOrder: 14 },

  // --- Furniture ---
  { key: 'furniture', name: 'Furniture', icon: '🪑', description: 'Home and office furniture', sortOrder: 20 },
  { key: 'sofa', name: 'Sofa', icon: '🛋️', description: 'Sofas, couches and settees', parent: 'furniture', sortOrder: 21 },
  { key: 'bed', name: 'Bed & Mattress', icon: '🛏️', description: 'Beds, mattresses and headboards', parent: 'furniture', sortOrder: 22 },
  { key: 'dining-table', name: 'Table', icon: '🍽️', description: 'Dining, coffee and study tables', parent: 'furniture', sortOrder: 23 },
  { key: 'office-chair', name: 'Chair', icon: '💺', description: 'Office and dining chairs', parent: 'furniture', sortOrder: 24 },
  { key: 'wardrobe', name: 'Wardrobe & Storage', icon: '🚪', description: 'Wardrobes, shelves and cabinets', parent: 'furniture', sortOrder: 25 },

  // --- Vehicles ---
  { key: 'vehicles', name: 'Vehicles', icon: '🚗', description: 'Two-wheelers, cars and cycles', sortOrder: 30 },
  { key: 'scooter', name: 'Scooter', icon: '🛵', description: 'Scooters and mopeds', parent: 'vehicles', sortOrder: 31 },
  { key: 'motorcycle', name: 'Motorcycle', icon: '🏍️', description: 'Bikes and cruisers', parent: 'vehicles', sortOrder: 32 },
  { key: 'car', name: 'Car', icon: '🚙', description: 'Hatchbacks, sedans and SUVs', parent: 'vehicles', sortOrder: 33 },
  { key: 'bicycle', name: 'Bicycle', icon: '🚲', description: 'Cycles and e-bikes', parent: 'vehicles', sortOrder: 34 },

  // --- Fashion ---
  { key: 'fashion', name: 'Fashion', icon: '👕', description: 'Clothing, footwear and accessories', sortOrder: 40 },
  { key: 'shoes', name: 'Shoes', icon: '👟', description: 'Sneakers, formals and sandals', parent: 'fashion', sortOrder: 41 },
  { key: 'clothing', name: 'Clothing', icon: '👗', description: 'Everyday and occasion wear', parent: 'fashion', sortOrder: 42 },
  { key: 'bags', name: 'Bags & Luggage', icon: '🎒', description: 'Backpacks, handbags and suitcases', parent: 'fashion', sortOrder: 43 },
  { key: 'watch', name: 'Watch', icon: '⌚', description: 'Analogue and digital watches', parent: 'fashion', sortOrder: 44 },

  // --- Hobbies ---
  { key: 'hobbies', name: 'Sports & Hobbies', icon: '🎯', description: 'Fitness, music and books', sortOrder: 50 },
  { key: 'fitness-equipment', name: 'Fitness Equipment', icon: '🏋️', description: 'Treadmills, weights and gym gear', parent: 'hobbies', sortOrder: 51 },
  { key: 'musical-instrument', name: 'Musical Instrument', icon: '🎸', description: 'Guitars, keyboards and more', parent: 'hobbies', sortOrder: 52 },
  { key: 'books', name: 'Books', icon: '📚', description: 'Fiction, academic and comics', parent: 'hobbies', sortOrder: 53 },

  // --- The escape hatch ---
  {
    key: 'everything-else',
    name: 'Everything Else',
    icon: '📦',
    description: 'Anything that does not fit the categories above',
    sortOrder: 90,
  },
];

// ---------------------------------------------------------------------------
// Global field library
// ---------------------------------------------------------------------------

interface FieldSeed {
  key: string;
  label: string;
  type: FieldType;
  helpText?: string;
  unit?: string;
  placeholder?: string;
  defaultValue?: string;
  validation?: Record<string, unknown>;
  options?: string[] | Array<{ value: string; label: string }>;
}

const FIELDS: FieldSeed[] = [
  // --- Shared across several categories ---
  // Free text rather than a dropdown: a marketplace spanning phones, shoes,
  // motorcycles and fridges cannot maintain one global brand enum. Per-category
  // brand option sets would be a natural extension of the `overrides` mechanism.
  {
    key: 'brand',
    label: 'Brand',
    type: 'TEXT',
    placeholder: 'e.g. Apple, Nike, Honda',
    validation: { maxLength: 40 },
  },
  { key: 'model', label: 'Model', type: 'TEXT', placeholder: 'e.g. iPhone 13 Pro', validation: { minLength: 2, maxLength: 60 } },
  { key: 'color', label: 'Colour', type: 'TEXT', placeholder: 'e.g. Graphite', validation: { maxLength: 30 } },
  {
    key: 'ram',
    label: 'RAM',
    type: 'SELECT',
    unit: 'GB',
    options: [
      { value: '2', label: '2 GB' }, { value: '3', label: '3 GB' }, { value: '4', label: '4 GB' },
      { value: '6', label: '6 GB' }, { value: '8', label: '8 GB' }, { value: '12', label: '12 GB' },
      { value: '16', label: '16 GB' }, { value: '32', label: '32 GB' },
    ],
  },
  {
    key: 'storage',
    label: 'Storage',
    type: 'SELECT',
    unit: 'GB',
    options: [
      { value: '32', label: '32 GB' }, { value: '64', label: '64 GB' }, { value: '128', label: '128 GB' },
      { value: '256', label: '256 GB' }, { value: '512', label: '512 GB' }, { value: '1024', label: '1 TB' },
    ],
  },
  {
    key: 'battery_health',
    label: 'Battery Health',
    type: 'NUMBER',
    unit: '%',
    helpText: 'Shown in Settings > Battery on most devices.',
    validation: { min: 0, max: 100, step: 1 },
  },
  { key: 'original_box', label: 'Original Box Included', type: 'BOOLEAN', defaultValue: 'false' },
  {
    key: 'accessories',
    label: 'Accessories Included',
    type: 'MULTISELECT',
    helpText: 'Select everything you are including in the sale.',
    options: ['Charger', 'Cable', 'Earphones', 'Case', 'Manual', 'Original Bill'],
  },
  { key: 'purchase_date', label: 'Purchase Date', type: 'DATE', validation: { min: '2005-01-01', max: '2026-12-31' } },
  {
    key: 'under_warranty',
    label: 'Under Warranty',
    type: 'RADIO',
    defaultValue: 'no',
    options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }],
  },
  {
    key: 'warranty_expiry',
    label: 'Warranty Expiry Date',
    type: 'DATE',
    helpText: 'Only asked when the item is still under warranty.',
    validation: { min: '2020-01-01', max: '2035-12-31' },
  },
  { key: 'additional_details', label: 'Additional Details', type: 'TEXTAREA', placeholder: 'Anything else a buyer should know?', validation: { maxLength: 1000 } },

  // --- Laptop ---
  {
    key: 'processor',
    label: 'Processor',
    type: 'SELECT',
    options: ['Intel Core i3', 'Intel Core i5', 'Intel Core i7', 'Intel Core i9', 'AMD Ryzen 5', 'AMD Ryzen 7', 'Apple M1', 'Apple M2', 'Apple M3'],
  },
  { key: 'graphics_card', label: 'Graphics Card', type: 'TEXT', placeholder: 'e.g. NVIDIA RTX 3050', validation: { maxLength: 60 } },
  { key: 'screen_size', label: 'Screen Size', type: 'NUMBER', unit: 'inches', validation: { min: 10, max: 20, step: 0.1 } },

  // --- Sofa ---
  { key: 'material', label: 'Material', type: 'SELECT', options: ['Fabric', 'Leather', 'Leatherette', 'Velvet', 'Wood', 'Cane'] },
  { key: 'seating_capacity', label: 'Seating Capacity', type: 'NUMBER', unit: 'seats', validation: { min: 1, max: 12, step: 1 } },
  {
    key: 'pet_friendly',
    label: 'Pet Friendly',
    type: 'RADIO',
    helpText: 'Scratch-resistant and easy to clean?',
    options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }],
  },
  { key: 'dimensions', label: 'Dimensions', type: 'TEXT', placeholder: 'L × W × H in cm', validation: { maxLength: 60 } },
  { key: 'purchase_year', label: 'Purchase Year', type: 'NUMBER', validation: { min: 1990, max: 2026, step: 1 } },

  // --- Displays & audio ---
  {
    key: 'resolution',
    label: 'Resolution',
    type: 'SELECT',
    options: [
      { value: 'hd', label: 'HD (720p)' }, { value: 'fhd', label: 'Full HD (1080p)' },
      { value: '4k', label: '4K Ultra HD' }, { value: '8k', label: '8K' },
    ],
  },
  {
    key: 'audio_type',
    label: 'Type',
    type: 'SELECT',
    options: [
      { value: 'over_ear', label: 'Over-ear headphones' }, { value: 'in_ear', label: 'In-ear / earbuds' },
      { value: 'speaker', label: 'Speaker' }, { value: 'soundbar', label: 'Soundbar' },
    ],
  },
  { key: 'noise_cancelling', label: 'Noise Cancelling', type: 'BOOLEAN', defaultValue: 'false' },
  { key: 'megapixels', label: 'Megapixels', type: 'NUMBER', unit: 'MP', validation: { min: 1, max: 200, step: 0.1 } },
  {
    key: 'camera_type',
    label: 'Camera Type',
    type: 'SELECT',
    options: [
      { value: 'dslr', label: 'DSLR' }, { value: 'mirrorless', label: 'Mirrorless' },
      { value: 'point_shoot', label: 'Point & shoot' }, { value: 'action', label: 'Action camera' },
    ],
  },
  { key: 'lens_included', label: 'Lens Included', type: 'BOOLEAN', defaultValue: 'true' },
  { key: 'shutter_count', label: 'Shutter Count', type: 'NUMBER', helpText: 'Approximate, if known.', validation: { min: 0, max: 999999, step: 1 } },
  { key: 'controllers_included', label: 'Controllers Included', type: 'NUMBER', unit: 'controllers', validation: { min: 0, max: 8, step: 1 } },
  { key: 'games_included', label: 'Games Included', type: 'TEXT', placeholder: 'e.g. FIFA 24, God of War', validation: { maxLength: 200 } },

  // --- Appliances ---
  { key: 'capacity_litres', label: 'Capacity', type: 'NUMBER', unit: 'L', validation: { min: 1, max: 1000, step: 1 } },
  {
    key: 'energy_rating',
    label: 'Energy Rating',
    type: 'SELECT',
    options: [
      { value: '1', label: '1 star' }, { value: '2', label: '2 star' }, { value: '3', label: '3 star' },
      { value: '4', label: '4 star' }, { value: '5', label: '5 star' },
    ],
  },
  {
    key: 'appliance_style',
    label: 'Type',
    type: 'SELECT',
    options: [
      { value: 'single_door', label: 'Single door' }, { value: 'double_door', label: 'Double door' },
      { value: 'side_by_side', label: 'Side by side' }, { value: 'front_load', label: 'Front load' },
      { value: 'top_load', label: 'Top load' }, { value: 'semi_automatic', label: 'Semi-automatic' },
      { value: 'split', label: 'Split' }, { value: 'window', label: 'Window' }, { value: 'portable', label: 'Portable' },
    ],
  },
  {
    key: 'tonnage',
    label: 'Tonnage',
    type: 'SELECT',
    unit: 'ton',
    options: [
      { value: '0.75', label: '0.75 ton' }, { value: '1', label: '1 ton' }, { value: '1.5', label: '1.5 ton' },
      { value: '2', label: '2 ton' },
    ],
  },
  { key: 'capacity_kg', label: 'Load Capacity', type: 'NUMBER', unit: 'kg', validation: { min: 1, max: 30, step: 0.5 } },

  // --- Vehicles ---
  { key: 'registration_year', label: 'Registration Year', type: 'NUMBER', validation: { min: 1980, max: 2026, step: 1 } },
  { key: 'kilometers_driven', label: 'Kilometres Driven', type: 'NUMBER', unit: 'km', validation: { min: 0, max: 500000, step: 1 } },
  {
    key: 'fuel_type',
    label: 'Fuel Type',
    type: 'SELECT',
    options: [
      { value: 'petrol', label: 'Petrol' }, { value: 'diesel', label: 'Diesel' },
      { value: 'electric', label: 'Electric' }, { value: 'cng', label: 'CNG' }, { value: 'hybrid', label: 'Hybrid' },
    ],
  },
  {
    key: 'transmission',
    label: 'Transmission',
    type: 'RADIO',
    options: [{ value: 'manual', label: 'Manual' }, { value: 'automatic', label: 'Automatic' }],
  },
  { key: 'engine_capacity', label: 'Engine Capacity', type: 'NUMBER', unit: 'cc', validation: { min: 25, max: 6000, step: 1 } },
  {
    key: 'ownership',
    label: 'Ownership',
    type: 'SELECT',
    options: [
      { value: 'first', label: 'First owner' }, { value: 'second', label: 'Second owner' },
      { value: 'third_plus', label: 'Third owner or more' },
    ],
  },
  { key: 'insurance_valid', label: 'Insurance Valid', type: 'RADIO', defaultValue: 'no', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
  { key: 'insurance_expiry', label: 'Insurance Valid Until', type: 'DATE', validation: { min: '2020-01-01', max: '2035-12-31' } },
  {
    key: 'bicycle_type',
    label: 'Bicycle Type',
    type: 'SELECT',
    options: [
      { value: 'mountain', label: 'Mountain' }, { value: 'road', label: 'Road' }, { value: 'hybrid', label: 'Hybrid' },
      { value: 'electric', label: 'Electric' }, { value: 'kids', label: "Kids'" },
    ],
  },
  { key: 'gears', label: 'Number of Gears', type: 'NUMBER', validation: { min: 1, max: 30, step: 1 } },

  // --- Fashion ---
  {
    key: 'gender',
    label: 'Intended For',
    type: 'SELECT',
    options: [
      { value: 'men', label: 'Men' }, { value: 'women', label: 'Women' },
      { value: 'unisex', label: 'Unisex' }, { value: 'kids', label: 'Kids' },
    ],
  },
  { key: 'shoe_size_uk', label: 'Size (UK)', type: 'NUMBER', unit: 'UK', validation: { min: 1, max: 15, step: 0.5 } },
  {
    key: 'clothing_size',
    label: 'Size',
    type: 'SELECT',
    options: [
      { value: 'xs', label: 'XS' }, { value: 's', label: 'S' }, { value: 'm', label: 'M' },
      { value: 'l', label: 'L' }, { value: 'xl', label: 'XL' }, { value: 'xxl', label: 'XXL' },
    ],
  },
  { key: 'worn_count', label: 'Times Worn', type: 'NUMBER', helpText: 'Roughly how many times has it been used?', validation: { min: 0, max: 1000, step: 1 } },
  {
    key: 'strap_material',
    label: 'Strap Material',
    type: 'SELECT',
    options: [
      { value: 'leather', label: 'Leather' }, { value: 'metal', label: 'Metal' },
      { value: 'silicone', label: 'Silicone' }, { value: 'fabric', label: 'Fabric' },
    ],
  },
  { key: 'water_resistant', label: 'Water Resistant', type: 'BOOLEAN', defaultValue: 'false' },

  // --- Hobbies ---
  {
    key: 'instrument_type',
    label: 'Instrument Type',
    type: 'SELECT',
    options: [
      { value: 'acoustic_guitar', label: 'Acoustic guitar' }, { value: 'electric_guitar', label: 'Electric guitar' },
      { value: 'keyboard', label: 'Keyboard / piano' }, { value: 'drums', label: 'Drums' },
      { value: 'violin', label: 'Violin' }, { value: 'other', label: 'Other' },
    ],
  },
  { key: 'accessories_included_text', label: 'Accessory Notes', type: 'TEXT', placeholder: 'e.g. gig bag, strap, picks', validation: { maxLength: 160 } },
  { key: 'author', label: 'Author', type: 'TEXT', placeholder: 'e.g. Ursula K. Le Guin', validation: { maxLength: 80 } },
  {
    key: 'book_genre',
    label: 'Genre',
    type: 'SELECT',
    options: [
      { value: 'fiction', label: 'Fiction' }, { value: 'nonfiction', label: 'Non-fiction' },
      { value: 'academic', label: 'Academic' }, { value: 'comics', label: 'Comics & graphic novels' },
      { value: 'childrens', label: "Children's" },
    ],
  },
  {
    key: 'book_format',
    label: 'Format',
    type: 'RADIO',
    options: [{ value: 'paperback', label: 'Paperback' }, { value: 'hardcover', label: 'Hardcover' }],
  },
  { key: 'language', label: 'Language', type: 'TEXT', defaultValue: 'English', validation: { maxLength: 40 } },
  {
    key: 'equipment_type',
    label: 'Equipment Type',
    type: 'SELECT',
    options: [
      { value: 'treadmill', label: 'Treadmill' }, { value: 'cycle', label: 'Exercise cycle' },
      { value: 'weights', label: 'Weights & dumbbells' }, { value: 'bench', label: 'Bench' },
      { value: 'other', label: 'Other' },
    ],
  },
  { key: 'max_user_weight', label: 'Max User Weight', type: 'NUMBER', unit: 'kg', validation: { min: 30, max: 250, step: 1 } },

  // --- Catch-all ---
  {
    key: 'item_type',
    label: 'What is it?',
    type: 'TEXT',
    helpText: 'Describe the kind of item in a few words, e.g. "espresso machine" or "garden tools".',
    placeholder: 'e.g. Espresso machine',
    validation: { minLength: 2, maxLength: 60 },
  },
  {
    key: 'key_specs',
    label: 'Key Details',
    type: 'TEXTAREA',
    helpText: 'List anything a buyer would want to know — size, capacity, age, model number.',
    placeholder: 'One detail per line',
    validation: { maxLength: 800 },
  },
];

// ---------------------------------------------------------------------------
// Attachments — which fields each category asks for
// ---------------------------------------------------------------------------

interface AttachmentSeed {
  field: string;
  section: string;
  required?: boolean;
  showInCard?: boolean;
  rule?: VisibilityRule;
  overrides?: Record<string, unknown>;
}

/**
 * Parent categories carry the fields their children share. `Mobile Phone` and
 * `Laptop` both inherit the entire warranty block from `Electronics` — defined
 * once, resolved automatically for every descendant.
 *
 * High sortOrder values on the parent keep inherited fields at the end of the
 * form, after each child's own specifications.
 */
const ATTACHMENTS: Record<string, AttachmentSeed[]> = {
  electronics: [
    { field: 'purchase_date', section: 'Purchase & Warranty' },
    { field: 'under_warranty', section: 'Purchase & Warranty', required: true },
    {
      field: 'warranty_expiry',
      section: 'Purchase & Warranty',
      // The conditional field from the brief: only asked when it applies.
      rule: { all: [{ field: 'under_warranty', op: 'eq', value: 'yes' }] },
    },
    { field: 'additional_details', section: 'Purchase & Warranty' },
  ],

  'mobile-phone': [
    { field: 'brand', section: 'Specifications', required: true, showInCard: true },
    { field: 'model', section: 'Specifications', required: true },
    { field: 'storage', section: 'Specifications', required: true, showInCard: true },
    { field: 'ram', section: 'Specifications' },
    { field: 'color', section: 'Specifications' },
    { field: 'battery_health', section: 'Condition & Accessories', required: true, showInCard: true },
    { field: 'original_box', section: 'Condition & Accessories' },
    { field: 'accessories', section: 'Condition & Accessories' },
  ],

  laptop: [
    { field: 'brand', section: 'Specifications', required: true, showInCard: true },
    { field: 'model', section: 'Specifications', required: true },
    { field: 'processor', section: 'Specifications', required: true, showInCard: true },
    // Same field as the phone, but required here — per-category configuration
    // on the join table, not a duplicated field definition.
    { field: 'ram', section: 'Specifications', required: true, showInCard: true },
    { field: 'storage', section: 'Specifications', required: true },
    { field: 'graphics_card', section: 'Specifications' },
    { field: 'screen_size', section: 'Specifications' },
    { field: 'battery_health', section: 'Condition & Accessories' },
    { field: 'original_box', section: 'Condition & Accessories' },
    { field: 'accessories', section: 'Condition & Accessories' },
  ],

  furniture: [
    { field: 'purchase_year', section: 'History' },
    { field: 'additional_details', section: 'History' },
  ],

  sofa: [
    { field: 'material', section: 'Specifications', required: true, showInCard: true },
    { field: 'seating_capacity', section: 'Specifications', required: true, showInCard: true },
    { field: 'color', section: 'Specifications' },
    { field: 'dimensions', section: 'Specifications', overrides: { maxLength: 40 } },
    { field: 'pet_friendly', section: 'Details', showInCard: true },
  ],

  // --- More electronics, all reusing the same field definitions ---

  tablet: [
    { field: 'brand', section: 'Specifications', required: true, showInCard: true },
    { field: 'model', section: 'Specifications', required: true },
    { field: 'storage', section: 'Specifications', required: true, showInCard: true },
    { field: 'ram', section: 'Specifications' },
    { field: 'screen_size', section: 'Specifications', showInCard: true },
    { field: 'color', section: 'Specifications' },
    { field: 'battery_health', section: 'Condition & Accessories' },
    { field: 'original_box', section: 'Condition & Accessories' },
    { field: 'accessories', section: 'Condition & Accessories' },
  ],

  television: [
    { field: 'brand', section: 'Specifications', required: true, showInCard: true },
    { field: 'model', section: 'Specifications' },
    { field: 'screen_size', section: 'Specifications', required: true, showInCard: true },
    { field: 'resolution', section: 'Specifications', required: true, showInCard: true },
    { field: 'original_box', section: 'Condition & Accessories' },
  ],

  camera: [
    { field: 'brand', section: 'Specifications', required: true, showInCard: true },
    { field: 'model', section: 'Specifications', required: true },
    { field: 'camera_type', section: 'Specifications', required: true, showInCard: true },
    { field: 'megapixels', section: 'Specifications', showInCard: true },
    { field: 'lens_included', section: 'Specifications' },
    { field: 'shutter_count', section: 'Condition & Accessories' },
    { field: 'original_box', section: 'Condition & Accessories' },
    { field: 'accessories', section: 'Condition & Accessories' },
  ],

  headphones: [
    { field: 'brand', section: 'Specifications', required: true, showInCard: true },
    { field: 'model', section: 'Specifications' },
    { field: 'audio_type', section: 'Specifications', required: true, showInCard: true },
    { field: 'noise_cancelling', section: 'Specifications', showInCard: true },
    { field: 'color', section: 'Specifications' },
    { field: 'original_box', section: 'Condition & Accessories' },
    { field: 'accessories', section: 'Condition & Accessories' },
  ],

  'gaming-console': [
    { field: 'brand', section: 'Specifications', required: true, showInCard: true },
    { field: 'model', section: 'Specifications', required: true },
    { field: 'storage', section: 'Specifications', showInCard: true },
    { field: 'controllers_included', section: 'Condition & Accessories', showInCard: true },
    { field: 'games_included', section: 'Condition & Accessories' },
    { field: 'original_box', section: 'Condition & Accessories' },
  ],

  smartwatch: [
    { field: 'brand', section: 'Specifications', required: true, showInCard: true },
    { field: 'model', section: 'Specifications', required: true },
    { field: 'strap_material', section: 'Specifications', showInCard: true },
    { field: 'water_resistant', section: 'Specifications' },
    { field: 'battery_health', section: 'Condition & Accessories', showInCard: true },
    { field: 'original_box', section: 'Condition & Accessories' },
  ],

  // --- Appliances: parent carries the block every appliance shares ---

  appliances: [
    { field: 'purchase_date', section: 'Purchase & Warranty' },
    { field: 'under_warranty', section: 'Purchase & Warranty', required: true },
    {
      field: 'warranty_expiry',
      section: 'Purchase & Warranty',
      rule: { all: [{ field: 'under_warranty', op: 'eq', value: 'yes' }] },
    },
    { field: 'additional_details', section: 'Purchase & Warranty' },
  ],

  refrigerator: [
    { field: 'brand', section: 'Specifications', required: true, showInCard: true },
    { field: 'capacity_litres', section: 'Specifications', required: true, showInCard: true },
    { field: 'appliance_style', section: 'Specifications', required: true, showInCard: true },
    { field: 'energy_rating', section: 'Specifications' },
    { field: 'color', section: 'Specifications' },
  ],

  'washing-machine': [
    { field: 'brand', section: 'Specifications', required: true, showInCard: true },
    { field: 'capacity_kg', section: 'Specifications', required: true, showInCard: true },
    { field: 'appliance_style', section: 'Specifications', required: true, showInCard: true },
    { field: 'energy_rating', section: 'Specifications' },
  ],

  'air-conditioner': [
    { field: 'brand', section: 'Specifications', required: true, showInCard: true },
    { field: 'tonnage', section: 'Specifications', required: true, showInCard: true },
    { field: 'appliance_style', section: 'Specifications', required: true, showInCard: true },
    { field: 'energy_rating', section: 'Specifications' },
  ],

  'kitchen-appliance': [
    { field: 'brand', section: 'Specifications', required: true, showInCard: true },
    { field: 'model', section: 'Specifications' },
    { field: 'capacity_litres', section: 'Specifications', showInCard: true },
    { field: 'color', section: 'Specifications' },
  ],

  // --- Furniture ---

  bed: [
    { field: 'material', section: 'Specifications', required: true, showInCard: true },
    { field: 'dimensions', section: 'Specifications', required: true, showInCard: true },
    { field: 'color', section: 'Specifications' },
  ],

  'dining-table': [
    { field: 'material', section: 'Specifications', required: true, showInCard: true },
    { field: 'seating_capacity', section: 'Specifications', showInCard: true },
    { field: 'dimensions', section: 'Specifications' },
    { field: 'color', section: 'Specifications' },
  ],

  'office-chair': [
    { field: 'material', section: 'Specifications', required: true, showInCard: true },
    { field: 'color', section: 'Specifications' },
    { field: 'max_user_weight', section: 'Specifications' },
  ],

  wardrobe: [
    { field: 'material', section: 'Specifications', required: true, showInCard: true },
    { field: 'dimensions', section: 'Specifications', required: true, showInCard: true },
    { field: 'color', section: 'Specifications' },
  ],

  // --- Vehicles: shared registration/insurance block on the parent ---

  vehicles: [
    { field: 'registration_year', section: 'Registration', showInCard: true },
    { field: 'ownership', section: 'Registration' },
    { field: 'insurance_valid', section: 'Registration' },
    {
      field: 'insurance_expiry',
      section: 'Registration',
      rule: { all: [{ field: 'insurance_valid', op: 'eq', value: 'yes' }] },
    },
    { field: 'additional_details', section: 'Registration' },
  ],

  scooter: [
    { field: 'brand', section: 'Specifications', required: true, showInCard: true },
    { field: 'model', section: 'Specifications', required: true },
    { field: 'kilometers_driven', section: 'Specifications', required: true, showInCard: true },
    { field: 'fuel_type', section: 'Specifications', required: true },
    { field: 'engine_capacity', section: 'Specifications' },
    { field: 'color', section: 'Specifications' },
  ],

  motorcycle: [
    { field: 'brand', section: 'Specifications', required: true, showInCard: true },
    { field: 'model', section: 'Specifications', required: true },
    { field: 'kilometers_driven', section: 'Specifications', required: true, showInCard: true },
    { field: 'engine_capacity', section: 'Specifications', required: true, showInCard: true },
    { field: 'fuel_type', section: 'Specifications' },
    { field: 'color', section: 'Specifications' },
  ],

  car: [
    { field: 'brand', section: 'Specifications', required: true, showInCard: true },
    { field: 'model', section: 'Specifications', required: true },
    { field: 'kilometers_driven', section: 'Specifications', required: true, showInCard: true },
    { field: 'fuel_type', section: 'Specifications', required: true, showInCard: true },
    { field: 'transmission', section: 'Specifications', required: true },
    { field: 'engine_capacity', section: 'Specifications' },
    { field: 'color', section: 'Specifications' },
  ],

  bicycle: [
    { field: 'brand', section: 'Specifications', showInCard: true },
    { field: 'bicycle_type', section: 'Specifications', required: true, showInCard: true },
    { field: 'gears', section: 'Specifications', showInCard: true },
    { field: 'material', section: 'Specifications' },
    { field: 'color', section: 'Specifications' },
  ],

  // --- Fashion: every child asks who it is for ---

  fashion: [
    { field: 'gender', section: 'Details', required: true },
    { field: 'worn_count', section: 'Details' },
    { field: 'additional_details', section: 'Details' },
  ],

  shoes: [
    { field: 'brand', section: 'Specifications', required: true, showInCard: true },
    { field: 'shoe_size_uk', section: 'Specifications', required: true, showInCard: true },
    { field: 'color', section: 'Specifications', showInCard: true },
    { field: 'material', section: 'Specifications' },
    { field: 'original_box', section: 'Specifications' },
  ],

  clothing: [
    { field: 'brand', section: 'Specifications', showInCard: true },
    { field: 'clothing_size', section: 'Specifications', required: true, showInCard: true },
    { field: 'material', section: 'Specifications' },
    { field: 'color', section: 'Specifications', showInCard: true },
  ],

  bags: [
    { field: 'brand', section: 'Specifications', required: true, showInCard: true },
    { field: 'material', section: 'Specifications', showInCard: true },
    { field: 'color', section: 'Specifications' },
    { field: 'dimensions', section: 'Specifications' },
  ],

  watch: [
    { field: 'brand', section: 'Specifications', required: true, showInCard: true },
    { field: 'model', section: 'Specifications' },
    { field: 'strap_material', section: 'Specifications', showInCard: true },
    { field: 'water_resistant', section: 'Specifications', showInCard: true },
    { field: 'original_box', section: 'Specifications' },
  ],

  // --- Hobbies ---

  hobbies: [
    { field: 'purchase_year', section: 'History' },
    { field: 'additional_details', section: 'History' },
  ],

  'fitness-equipment': [
    { field: 'equipment_type', section: 'Specifications', required: true, showInCard: true },
    { field: 'brand', section: 'Specifications', showInCard: true },
    { field: 'max_user_weight', section: 'Specifications', showInCard: true },
    { field: 'dimensions', section: 'Specifications' },
  ],

  'musical-instrument': [
    { field: 'instrument_type', section: 'Specifications', required: true, showInCard: true },
    { field: 'brand', section: 'Specifications', showInCard: true },
    { field: 'model', section: 'Specifications' },
    { field: 'color', section: 'Specifications' },
    { field: 'accessories_included_text', section: 'Specifications' },
  ],

  books: [
    { field: 'author', section: 'Specifications', required: true, showInCard: true },
    { field: 'book_genre', section: 'Specifications', required: true, showInCard: true },
    { field: 'book_format', section: 'Specifications', showInCard: true },
    { field: 'language', section: 'Specifications' },
  ],

  // --- The escape hatch ---
  //
  // Only two questions specific to it, so listing an unusual item is never
  // blocked by a form that does not fit. Everything else a buyer needs comes
  // from the free-text details field.
  'everything-else': [
    { field: 'item_type', section: 'About the item', required: true, showInCard: true },
    { field: 'brand', section: 'About the item' },
    { field: 'color', section: 'About the item' },
    { field: 'key_specs', section: 'About the item' },
    { field: 'purchase_year', section: 'About the item' },
    { field: 'additional_details', section: 'About the item' },
  ],
};

// ---------------------------------------------------------------------------
// Sample listings
// ---------------------------------------------------------------------------

interface ListingSeed {
  category: string;
  title: string;
  description: string;
  price: number;
  condition: ListingCondition;
  city: string;
  /** Unsplash photo ids, chosen to actually match each product. */
  images: Array<{ photoId: string; alt: string }>;
  attributes: Record<string, unknown>;
}

const LISTINGS: ListingSeed[] = [
  {
    category: 'mobile-phone',
    title: 'iPhone 13 Pro 256GB — Graphite',
    description:
      'Selling my iPhone 13 Pro in graphite. Used with a case and screen protector since day one, so the body and display are in excellent shape. Battery still holds a full day comfortably. Includes the original box and cable.',
    price: 54999,
    condition: 'LIKE_NEW',
    city: 'Bengaluru',
    images: [
      { photoId: '1592750475338-74b7b21085ab', alt: 'Graphite iPhone 13 Pro rear showing the triple camera' },
      { photoId: '1511707171634-5f897ff02aa9', alt: 'iPhone 13 Pro front display with app icons' },
    ],
    attributes: {
      brand: 'Apple', model: 'iPhone 13 Pro', storage: '256', ram: '6', color: 'Graphite',
      battery_health: 89, original_box: true, accessories: ['Cable', 'Case', 'Original Bill'],
      purchase_date: '2022-08-14', under_warranty: 'no',
      additional_details: 'Face ID and all cameras work perfectly. No repairs, no water damage.',
    },
  },
  {
    category: 'mobile-phone',
    title: 'Samsung Galaxy S23 128GB — Phantom Black',
    description:
      'Galaxy S23 bought last year and still under Samsung warranty. Immaculate condition, no scratches on the screen or frame. Selling because I switched to a work-issued phone. Comes with charger and original packaging.',
    price: 42000,
    condition: 'LIKE_NEW',
    city: 'Pune',
    images: [
      { photoId: '1610945415295-d9bbf067e59c', alt: 'Samsung Galaxy handset with its retail box' },
      { photoId: '1598327105666-5b89351aff97', alt: 'Samsung Galaxy front display' },
    ],
    attributes: {
      brand: 'Samsung', model: 'Galaxy S23', storage: '128', ram: '8', color: 'Phantom Black',
      battery_health: 96, original_box: true, accessories: ['Charger', 'Cable', 'Manual'],
      purchase_date: '2024-03-02', under_warranty: 'yes', warranty_expiry: '2026-03-02',
    },
  },
  {
    category: 'laptop',
    title: 'MacBook Air M2 2022 — 16GB / 512GB',
    description:
      'MacBook Air M2 with the 16GB RAM upgrade, ideal for development work. Cycle count is low and the chassis has no dents. AppleCare ran out this year. Ships with the original 35W dual-port charger.',
    price: 89000,
    condition: 'GOOD',
    city: 'Hyderabad',
    images: [
      { photoId: '1496181133206-80ce9b88a853', alt: 'Silver MacBook Air open on a wooden desk' },
      { photoId: '1517336714731-489689fd1ca8', alt: 'MacBook Air lid and keyboard detail' },
    ],
    attributes: {
      brand: 'Apple', model: 'MacBook Air M2', processor: 'Apple M2', ram: '16', storage: '512',
      screen_size: 13.6, battery_health: 91, original_box: false,
      accessories: ['Charger', 'Cable'], purchase_date: '2022-11-20', under_warranty: 'no',
    },
  },
  {
    category: 'laptop',
    title: 'Dell XPS 15 — i7, RTX 3050, 1TB',
    description:
      'Dell XPS 15 with a Core i7 and discrete RTX 3050 graphics. Handles video editing and light gaming without trouble. Minor scuff on the lid, otherwise excellent. Still has a year of onsite warranty left.',
    price: 112000,
    condition: 'GOOD',
    city: 'Gurugram',
    images: [
      { photoId: '1588872657578-7efd1f1555ed', alt: 'Dell XPS 15 open, showing the display and keyboard' },
    ],
    attributes: {
      brand: 'Dell', model: 'XPS 15 9520', processor: 'Intel Core i7', ram: '16', storage: '1024',
      graphics_card: 'NVIDIA RTX 3050', screen_size: 15.6, battery_health: 84,
      original_box: true, accessories: ['Charger', 'Original Bill'],
      purchase_date: '2023-06-11', under_warranty: 'yes', warranty_expiry: '2026-06-11',
      additional_details: 'Serviced at a Dell centre in January, invoice available.',
    },
  },
  {
    category: 'sofa',
    title: 'Three-Seater Fabric Sofa — Charcoal Grey',
    description:
      'Comfortable three-seater in charcoal grey fabric. Bought from a local furniture studio and used in a low-traffic living room. Cushions are still firm and the frame has no wobble. Buyer arranges pickup.',
    price: 18500,
    condition: 'GOOD',
    city: 'Mumbai',
    images: [
      { photoId: '1493663284031-b7e3aefcae8e', alt: 'Charcoal grey three-seater fabric sofa in a living room' },
    ],
    attributes: {
      material: 'Fabric', seating_capacity: 3, color: 'Charcoal Grey',
      dimensions: '210 × 90 × 85 cm', pet_friendly: 'no', purchase_year: 2021,
      additional_details: 'Covers are removable and machine washable.',
    },
  },
  {
    category: 'sofa',
    title: 'Two-Seater Leather Loveseat — Tan',
    description:
      'Genuine leather loveseat in tan. The leather has developed a nice patina and is free of tears. Sturdy hardwood frame. Selling as it does not fit the new apartment layout.',
    price: 24000,
    condition: 'FAIR',
    city: 'Chennai',
    images: [
      { photoId: '1540574163026-643ea20ade25', alt: 'Tan leather loveseat with wooden legs' },
    ],
    attributes: {
      material: 'Leather', seating_capacity: 2, color: 'Tan',
      dimensions: '150 × 88 × 80 cm', pet_friendly: 'yes', purchase_year: 2019,
    },
  },

  // --- Categories beyond the original three, to show the breadth the schema
  //     engine supports without any new code. ---

  {
    category: 'shoes',
    title: 'Nike Free RN Flyknit — UK 9, Red',
    description:
      'Nike Free RN Flyknit in red, worn for about a dozen easy runs before I moved to trail shoes. Uppers are clean and the sole has plenty of life left. Comes in the original box.',
    price: 3200,
    condition: 'GOOD',
    city: 'Bengaluru',
    images: [
      { photoId: '1542291026-7eec264c27ff', alt: 'Red Nike Free RN Flyknit running shoe' },
      { photoId: '1460353581641-37baddab0fa2', alt: 'White Nike sneakers worn outdoors' },
    ],
    attributes: {
      brand: 'Nike', shoe_size_uk: 9, color: 'Red', material: 'Fabric', original_box: true,
      gender: 'men', worn_count: 12,
      additional_details: 'Non-smoking home, always stored indoors.',
    },
  },
  {
    category: 'motorcycle',
    title: 'Ducati SuperSport 950 — 12,400 km',
    description:
      'Ducati SuperSport 950 in Ducati Red, first owner, fully serviced at the authorised centre. Termignoni exhaust fitted, original included. Garage kept and never dropped. Selling because I am relocating.',
    price: 985000,
    condition: 'GOOD',
    city: 'Pune',
    images: [{ photoId: '1568772585407-9361f9bf3a87', alt: 'Red Ducati SuperSport parked' }],
    attributes: {
      brand: 'Ducati', model: 'SuperSport 950', kilometers_driven: 12400, engine_capacity: 937,
      fuel_type: 'petrol', color: 'Ducati Red', registration_year: 2021, ownership: 'first',
      insurance_valid: 'yes', insurance_expiry: '2026-11-30',
      additional_details: 'Full service history available, all bills retained.',
    },
  },
  {
    category: 'refrigerator',
    title: 'Smeg FAB32 Retro Fridge — 270L, Mint',
    description:
      'Smeg FAB32 in pastel mint, the retro double-door model. Cools perfectly and the seals are intact. A couple of light marks on the side panel, nothing on the front. Buyer arranges transport.',
    price: 78000,
    condition: 'GOOD',
    city: 'Mumbai',
    images: [{ photoId: '1571175443880-49e1d25b2bc5', alt: 'Mint green retro Smeg refrigerator in a kitchen' }],
    attributes: {
      brand: 'Smeg', capacity_litres: 270, appliance_style: 'double_door', energy_rating: '4',
      color: 'Pastel Mint', purchase_date: '2022-04-18', under_warranty: 'no',
      additional_details: 'Original manual and shelves all present.',
    },
  },
  {
    category: 'musical-instrument',
    title: 'Electric Guitar with Practice Amp — Ebony',
    description:
      'Explorer-style electric guitar in satin ebony, bundled with a 15W practice amp. Frets are in good shape and it holds tuning well. Ideal first electric. Includes cable, strap and a stand.',
    price: 26500,
    condition: 'GOOD',
    city: 'Hyderabad',
    images: [{ photoId: '1550985616-10810253b84d', alt: 'Black electric guitar on a stand beside a practice amplifier' }],
    attributes: {
      instrument_type: 'electric_guitar', brand: 'Epiphone', model: 'Explorer', color: 'Ebony',
      accessories_included_text: 'Practice amp, cable, strap, stand', purchase_year: 2020,
      additional_details: 'Recently restrung with 10-46 gauge.',
    },
  },
  {
    // Demonstrates the escape hatch: an item with no dedicated category is still
    // listable, described through the generic fields.
    category: 'everything-else',
    title: '4-Person Camping Tent — Weatherproof',
    description:
      'Four-person dome tent used on three trips. Fully weatherproof with a sewn-in groundsheet and a good-sized vestibule for boots and packs. Dries fast and packs down small. No tears or broken poles.',
    price: 4500,
    condition: 'GOOD',
    city: 'Dehradun',
    images: [{ photoId: '1504280390367-361c6d9f38f4', alt: 'View from inside a camping tent looking out at a forest' }],
    attributes: {
      item_type: 'Camping tent', brand: 'Decathlon', color: 'Orange', purchase_year: 2022,
      key_specs:
        'Sleeps 4\nDouble-wall dome, sewn-in groundsheet\n3000 mm hydrostatic head\nPacked size 60 × 20 cm, 4.2 kg\nAll pegs and guy lines included',
      additional_details: 'Cleaned and fully dried before storage.',
    },
  },
];

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 900;

/**
 * Unsplash CDN URL for a specific photo.
 *
 * Deliberately specific photo ids rather than a random-image service: each was
 * picked to match the product it illustrates, so a phone listing shows a phone.
 * `fit=crop` with fixed dimensions keeps every card the same aspect ratio.
 */
function imageUrl(photoId: string, width = IMAGE_WIDTH, height = IMAGE_HEIGHT): string {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${width}&h=${height}&q=80`;
}

function normaliseOptions(seed: FieldSeed): Array<{ value: string; label: string; sortOrder: number }> {
  if (!seed.options) return [];
  return seed.options.map((option, index) =>
    typeof option === 'string'
      ? { value: option, label: option, sortOrder: index }
      : { ...option, sortOrder: index },
  );
}

async function reset(): Promise<void> {
  // Order matters: children before parents to satisfy foreign keys.
  await prisma.listingImage.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.categoryField.deleteMany();
  await prisma.fieldOption.deleteMany();
  await prisma.field.deleteMany();
  // Child categories reference parents via Restrict, so clear leaves first.
  await prisma.category.deleteMany({ where: { parentId: { not: null } } });
  await prisma.category.deleteMany();
}

async function seedCategories(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  // Parents first so children can reference them.
  for (const seed of [...CATEGORIES].sort((a, b) => Number(!!a.parent) - Number(!!b.parent))) {
    const category = await prisma.category.create({
      data: {
        name: seed.name,
        slug: seed.key,
        description: seed.description,
        icon: seed.icon,
        sortOrder: seed.sortOrder,
        parentId: seed.parent ? ids.get(seed.parent) ?? null : null,
      },
    });
    ids.set(seed.key, category.id);
  }

  return ids;
}

async function seedFields(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const seed of FIELDS) {
    const field = await prisma.field.create({
      data: {
        key: seed.key,
        label: seed.label,
        type: seed.type,
        helpText: seed.helpText ?? null,
        unit: seed.unit ?? null,
        placeholder: seed.placeholder ?? null,
        defaultValue: seed.defaultValue ?? null,
        validation: (seed.validation ?? {}) as object,
        options: { create: normaliseOptions(seed) },
      },
    });
    ids.set(seed.key, field.id);
  }

  return ids;
}

async function seedAttachments(
  categoryIds: Map<string, string>,
  fieldIds: Map<string, string>,
): Promise<void> {
  for (const [categorySlug, attachments] of Object.entries(ATTACHMENTS)) {
    const categoryId = categoryIds.get(categorySlug);
    if (!categoryId) throw new Error(`Unknown category "${categorySlug}" in ATTACHMENTS.`);

    // Parent categories sort after children so inherited blocks land at the end.
    const isParent = !CATEGORIES.find((c) => c.key === categorySlug)?.parent;
    const base = isParent ? 100 : 0;

    for (const [index, attachment] of attachments.entries()) {
      const fieldId = fieldIds.get(attachment.field);
      if (!fieldId) throw new Error(`Unknown field "${attachment.field}" in ATTACHMENTS.`);

      await prisma.categoryField.create({
        data: {
          categoryId,
          fieldId,
          isRequired: attachment.required ?? false,
          sortOrder: base + index,
          section: attachment.section,
          showInCard: attachment.showInCard ?? false,
          visibilityRule: (attachment.rule ?? undefined) as object | undefined,
          overrides: (attachment.overrides ?? undefined) as object | undefined,
        },
      });
    }
  }
}

/**
 * Loads a category's resolved schema using the same resolver the API uses, so
 * seeded listings are validated exactly as a real submission would be.
 */
async function loadSchema(categoryId: string) {
  const category = await prisma.category.findUniqueOrThrow({ where: { id: categoryId } });

  const ancestors = [];
  let cursor = category;
  while (cursor.parentId) {
    const parent = await prisma.category.findUniqueOrThrow({ where: { id: cursor.parentId } });
    ancestors.unshift(parent);
    cursor = parent;
  }

  const chainIds = [...ancestors.map((a) => a.id), category.id];
  const attachments = await prisma.categoryField.findMany({
    where: { categoryId: { in: chainIds } },
    include: { field: { include: { options: true } } },
  });

  return resolveFormSchema({
    category,
    ancestors,
    attachments: attachments.map((row) => ({
      categoryId: row.categoryId,
      isRequired: row.isRequired,
      sortOrder: row.sortOrder,
      section: row.section,
      showInCard: row.showInCard,
      visibilityRule: row.visibilityRule,
      overrides: row.overrides,
      field: { ...row.field, type: row.field.type as FieldType },
    })),
  });
}

async function seedListings(categoryIds: Map<string, string>): Promise<void> {
  for (const seed of LISTINGS) {
    const categoryId = categoryIds.get(seed.category);
    if (!categoryId) throw new Error(`Unknown category "${seed.category}" in LISTINGS.`);

    const schema = await loadSchema(categoryId);
    const result = validateAttributes(schema, seed.attributes);

    if (hasErrors(result)) {
      throw new Error(
        `Seed listing "${seed.title}" failed validation: ${JSON.stringify(result.errors, null, 2)}`,
      );
    }

    await prisma.listing.create({
      data: {
        slug: `${slugify(seed.title)}-${Math.random().toString(36).slice(2, 6)}`,
        sellerId: 'demo-seller',
        sellerName: 'Demo Seller',
        categoryId,
        title: seed.title,
        description: seed.description,
        priceCents: Math.round(seed.price * 100),
        currency: 'INR',
        condition: seed.condition,
        city: seed.city,
        status: 'ACTIVE',
        attributes: result.values as object,
        schemaSnapshot: buildSnapshot(result.visibleFields, result.values) as object,
        images: {
          create: seed.images.map((image, index) => ({
            url: imageUrl(image.photoId),
            alt: image.alt,
            width: IMAGE_WIDTH,
            height: IMAGE_HEIGHT,
            // Externally hosted, so there is no storage key and nothing for the
            // delete path to remove from our own provider.
            storageKey: null,
            sortOrder: index,
          })),
        },
      },
    });
  }
}

async function main(): Promise<void> {
  // Guard against destroying real data.
  //
  // `npm run seed` is safe to run anywhere: if the database already has
  // categories it stops rather than wiping them. Only `npm run seed:fresh`
  // (or SEED_FORCE=true) performs the destructive reset. Without this, a seed
  // wired into a deploy hook would erase every listing on each release.
  // A CLI flag rather than an env var: `VAR=x cmd` is not portable to Windows
  // shells, and this script must run the same way everywhere.
  const force = process.argv.includes('--force') || process.env.SEED_FORCE === 'true';
  const existing = await prisma.category.count();

  if (existing > 0 && !force) {
    const listings = await prisma.listing.count();
    console.log(
      `Database already contains ${existing} categories and ${listings} listings — nothing to do.\n` +
        'Run `npm run seed:fresh` to wipe and reseed.',
    );
    return;
  }

  if (existing > 0) console.log('Force flag set — wiping existing data.');
  console.log('Resetting database…');
  await reset();

  console.log('Seeding categories…');
  const categoryIds = await seedCategories();

  console.log('Seeding field library…');
  const fieldIds = await seedFields();

  console.log('Attaching fields to categories…');
  await seedAttachments(categoryIds, fieldIds);

  console.log('Creating sample listings…');
  await seedListings(categoryIds);

  console.log(
    `\nDone: ${CATEGORIES.length} categories, ${FIELDS.length} fields, ${LISTINGS.length} listings.`,
  );
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
