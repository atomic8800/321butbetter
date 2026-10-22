export const GENDERS = [
  "Woman",
  "Man",
  "Non-binary",
  "Genderfluid",
  "Genderqueer",
  "Agender",
  "Bigender",
  "Trans woman",
  "Trans man",
  "Two-Spirit",
  "Intersex",
  "Demigirl",
  "Demiboy",
  "Questioning",
  "Prefer not to say",
] as const;

export const SEXUALITIES = [
  "Straight",
  "Gay",
  "Lesbian",
  "Bisexual",
  "Pansexual",
  "Asexual",
  "Aromantic",
  "Demisexual",
  "Omnisexual",
  "Polysexual",
  "Queer",
  "Questioning",
  "Prefer not to say",
] as const;

export const RELATIONSHIP_STATUSES = [
  "Single",
  "Taken",
  "In a relationship",
  "Engaged",
  "Married",
  "It's complicated",
  "Open relationship",
  "Polyamorous",
  "Not looking",
  "Looking for friends",
  "Prefer not to say",
] as const;

export const PRONOUNS = [
  "she/her",
  "he/him",
  "they/them",
  "she/they",
  "he/they",
  "it/its",
  "any pronouns",
  "ask me",
] as const;

export const ACCENT_COLORS = [
  "#fb923c",
  "#f97316",
  "#fbbf24",
  "#facc15",
  "#fb7185",
  "#f472b6",
  "#4ade80",
  "#2dd4bf",
  "#38bdf8",
  "#a78bfa",
  "#f5f5f4",
] as const;

export const CUSTOM_OPTION = "Custom…";

export const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria",
  "Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia",
  "Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cabo Verde","Cambodia",
  "Cameroon","Canada","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica",
  "Côte d'Ivoire","Croatia","Cuba","Cyprus","Czechia","Denmark","Djibouti","Dominica","Dominican Republic","DR Congo",
  "Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland","France",
  "Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana","Haiti",
  "Honduras","Hong Kong","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Jamaica","Japan",
  "Jordan","Kazakhstan","Kenya","Kiribati","Kosovo","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia",
  "Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta",
  "Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco",
  "Mozambique","Myanmar","Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria",
  "North Korea","North Macedonia","Norway","Oman","Pakistan","Palau","Palestine","Panama","Papua New Guinea","Paraguay",
  "Peru","Philippines","Poland","Portugal","Puerto Rico","Qatar","Romania","Russia","Rwanda","Saint Kitts and Nevis",
  "Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino","São Tomé and Príncipe","Saudi Arabia","Senegal",
  "Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa",
  "South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan",
  "Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu",
  "Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu",
  "Vatican City","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe",
];

// Vercel rejects any request body over 4.5 MB, so every upload stays at or under 4 MB.
const UPLOAD_MAX = 4 * 1024 * 1024;

export const LIMITS = {
  image: UPLOAD_MAX,
  music: UPLOAD_MAX,
  chatImage: UPLOAD_MAX,
  chatVideo: UPLOAD_MAX,
  /** Combined size of all photos/videos in one wall post (sent in a single request). */
  postTotal: UPLOAD_MAX,
  postMedia: 4,
  post: 2000,
  bio: 240,
  message: 1000,
};
