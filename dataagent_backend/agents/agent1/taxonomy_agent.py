"""
Taxonomy Correlation Agent - FREE VERSION
Uses Groq API (Llama 3) - Completely free, no credit card required!
Alternative: Also supports Ollama (100% local, no API needed)
"""

import os
import json
import re
from typing import Dict, Optional
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()


class TaxonomyAgent:
    """
    LLM-powered parser using FREE APIs
    Option 1: Groq (Llama 3) - Free, fast, no credit card
    Option 2: Ollama - 100% local, no API needed
    Option 3: Hugging Face - Free inference API
    """
    
    def __init__(self, api_key: Optional[str] = None, provider: str = "groq"):
        """
        Initialize taxonomy agent with free provider
        
        Providers:
        - "groq": Free Groq API (recommended - fastest)
        - "ollama": Local Ollama (no API needed)
        - "huggingface": Free Hugging Face API
        """
        self.provider = provider
        self.cache: Dict[str, Dict] = {}
        
        if provider == "groq":
            self._init_groq(api_key)
        elif provider == "ollama":
            self._init_ollama()
        elif provider == "huggingface":
            self._init_huggingface(api_key)
        else:
            raise ValueError(f"Unknown provider: {provider}")
    
    def _init_groq(self, api_key: Optional[str] = None):
        """Initialize Groq API (FREE - no credit card needed!)"""
        try:
            from groq import Groq
            
            self.api_key = api_key or os.getenv("GROQ_API_KEY")
            if not self.api_key:
                raise ValueError(
                    "❌ GROQ_API_KEY not found!\n"
                    "Get FREE API key (no credit card):\n"
                    "1. Go to: https://console.groq.com/\n"
                    "2. Sign up (free)\n"
                    "3. Generate API key\n"
                    "4. Add to .env: GROQ_API_KEY=your_key_here"
                )
            
            self.client = Groq(api_key=self.api_key)
            self.model = "llama-3.3-70b-versatile"  # Fast and free!
            logger.info("✅ Groq API (Llama 3) initialized - FREE")
            
        except ImportError:
            raise ImportError("Install: pip install groq")
    
    def _init_ollama(self):
        """Initialize Ollama (100% local - no API needed!)"""
        try:
            import requests
            
            # Check if Ollama is running
            response = requests.get("http://localhost:11434/api/tags")
            if response.status_code != 200:
                raise ConnectionError(
                    "❌ Ollama not running!\n"
                    "Install Ollama:\n"
                    "1. Go to: https://ollama.ai/\n"
                    "2. Download and install\n"
                    "3. Run: ollama pull llama3.2\n"
                    "4. Start: ollama serve"
                )
            
            self.model = "llama3.2"
            logger.info("✅ Ollama initialized - 100% LOCAL & FREE")
            
        except ImportError:
            raise ImportError("Install: pip install requests")
    
    def _init_huggingface(self, api_key: Optional[str] = None):
        """Initialize Hugging Face API (FREE)"""
        try:
            from huggingface_hub import InferenceClient
            
            self.api_key = api_key or os.getenv("HUGGINGFACE_API_KEY")
            if not self.api_key:
                raise ValueError(
                    "❌ HUGGINGFACE_API_KEY not found!\n"
                    "Get FREE API key:\n"
                    "1. Go to: https://huggingface.co/settings/tokens\n"
                    "2. Create token (free)\n"
                    "3. Add to .env: HUGGINGFACE_API_KEY=your_key_here"
                )
            
            self.client = InferenceClient(token=self.api_key)
            self.model = "meta-llama/Llama-3.2-3B-Instruct"
            logger.info("✅ Hugging Face API initialized - FREE")
            
        except ImportError:
            raise ImportError("Install: pip install huggingface_hub")
    
    def parse_product(self, product_name: str, use_cache: bool = True) -> Dict:
        """
        Parse a product name into structured taxonomy
        
        Returns taxonomy dictionary with confidence score
        """
        
        # Check cache first
        if use_cache and product_name in self.cache:
            logger.info(f"📦 Cache hit for: {product_name}")
            return self.cache[product_name]
        
        # Create the prompt
        prompt = self._build_taxonomy_prompt(product_name)
        
        try:
            # Call appropriate API
            if self.provider == "groq":
                response_text = self._call_groq(prompt)
            elif self.provider == "ollama":
                response_text = self._call_ollama(prompt)
            elif self.provider == "huggingface":
                response_text = self._call_huggingface(prompt)
            
            # Parse JSON response
            taxonomy = self._parse_response(response_text, product_name)
            
            # Cache the result
            if use_cache:
                self.cache[product_name] = taxonomy
            
            logger.info(f"✅ Parsed: {product_name} → {taxonomy['brand']} {taxonomy['sub_type']}")
            
            return taxonomy
            
        except Exception as e:
            logger.error(f"❌ Error parsing product '{product_name}': {e}")
            return self._get_fallback_taxonomy(product_name)
    
    def _call_groq(self, prompt: str) -> str:
        """Call Groq API"""
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a product taxonomy expert. Always respond with valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=500
        )
        return response.choices[0].message.content
    
    def _call_ollama(self, prompt: str) -> str:
        """Call Ollama locally"""
        import requests
        
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.1
                }
            }
        )
        
        if response.status_code == 200:
            return response.json()["response"]
        else:
            raise Exception(f"Ollama error: {response.status_code}")
    
    def _call_huggingface(self, prompt: str) -> str:
        """Call Hugging Face API"""
        response = self.client.text_generation(
            prompt,
            model=self.model,
            max_new_tokens=500,
            temperature=0.1
        )
        return response
    
    def _build_taxonomy_prompt(self, product_name: str) -> str:
        """Build the prompt for LLM"""
        return f"""You are a product taxonomy expert for e-commerce data standardization.

Parse this product name into a structured taxonomy: "{product_name}"

Extract the following fields:
1. main_category: The broad category (e.g., Skincare, Haircare, Cosmetics, Personal Care)
2. sub_type: The specific product type (e.g., Face Wash, Shampoo, Lipstick, Body Wash)
3. brand: The brand name (e.g., Nivea, Dove, Loreal)
4. size: The numeric size/quantity (e.g., 50, 250, 3.6)
5. unit: The unit of measurement (e.g., ml, g, gm, oz, L) - use null if not specified or it's "ct" (count) or "pack"
6. container: The container type (e.g., Bottle, Tube, Jar, Pump, Tub) - use null if not specified
7. confidence: Your confidence in this parsing (0.0 to 1.0)

Rules:
- If a field is missing or unclear, use null
- Standardize units (convert "ML" to "ml", "gm" to "g", etc.)
- Extract only numeric values for size (no text)
- Be consistent with capitalization (Title Case for categories/brands)
- If confidence < 0.7, the entry needs human review

Return ONLY a valid JSON object with these exact keys (no markdown, no explanation):
{{
    "main_category": "...",
    "sub_type": "...",
    "brand": "...",
    "size": ...,
    "unit": "...",
    "container": "...",
    "confidence": 0.95
}}

Examples:
Input: "Nivea Men Oil Ctrl 50ml glass btl"
Output: {{"main_category": "Skincare", "sub_type": "Face Wash", "brand": "Nivea", "size": 50, "unit": "ml", "container": "Bottle", "confidence": 0.90}}

Input: "Dove Body Wash 250ML Pump"
Output: {{"main_category": "Personal Care", "sub_type": "Body Wash", "brand": "Dove", "size": 250, "unit": "ml", "container": "Pump", "confidence": 0.95}}

Now parse: "{product_name}"

JSON only:"""
    
    def _parse_response(self, response_text: str, original_product: str) -> Dict:
        """Parse LLM's JSON response"""
        try:
            # Extract JSON from response (handle markdown code blocks)
            json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
                taxonomy = json.loads(json_str)
            else:
                # Try parsing the whole response
                taxonomy = json.loads(response_text)
            
            # Add metadata
            taxonomy['original_name'] = original_product
            taxonomy['needs_review'] = taxonomy.get('confidence', 0) < 0.7
            
            # Validate and clean
            taxonomy = self._validate_taxonomy(taxonomy)
            
            return taxonomy
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ JSON parsing error: {e}")
            logger.error(f"Response was: {response_text[:200]}")
            return self._get_fallback_taxonomy(original_product)
    
    def _validate_taxonomy(self, taxonomy: Dict) -> Dict:
        """Validate and clean taxonomy fields"""
        
        # Ensure all required fields exist
        required_fields = ['main_category', 'sub_type', 'brand', 'size', 'unit', 'container', 'confidence']
        for field in required_fields:
            if field not in taxonomy:
                taxonomy[field] = None
        
        # Clean numeric fields
        if taxonomy['size'] is not None:
            try:
                taxonomy['size'] = float(taxonomy['size'])
            except (ValueError, TypeError):
                taxonomy['size'] = None
        
        # Clean confidence
        if taxonomy['confidence'] is not None:
            try:
                confidence = float(taxonomy['confidence'])
                taxonomy['confidence'] = max(0.0, min(1.0, confidence))
            except (ValueError, TypeError):
                taxonomy['confidence'] = 0.5
        else:
            taxonomy['confidence'] = 0.5
        
        return taxonomy
    
    def _get_fallback_taxonomy(self, product_name: str) -> Dict:
        """
        Fallback taxonomy when API fails
        Uses simple regex patterns
        """
        taxonomy = {
            'original_name': product_name,
            'main_category': None,
            'sub_type': None,
            'brand': None,
            'size': None,
            'unit': None,
            'container': None,
            'confidence': 0.3,
            'needs_review': True
        }
        
        # Try to extract basic info with regex
        # Extract size and unit
        size_match = re.search(r'(\d+\.?\d*)\s*(ml|g|gm|oz|l|kg|mg)', product_name, re.IGNORECASE)
        if size_match:
            taxonomy['size'] = float(size_match.group(1))
            taxonomy['unit'] = size_match.group(2).lower()
        
        # Extract brand (first word often is brand)
        words = product_name.split()
        if words:
            taxonomy['brand'] = words[0].title()
        
        logger.warning(f"⚠️  Using fallback taxonomy for: {product_name}")
        
        return taxonomy
    
    def batch_parse(self, product_names: list, show_progress: bool = True) -> list:
        """
        Parse multiple products
        Returns list of taxonomy dictionaries
        """
        results = []
        total = len(product_names)
        
        for idx, product_name in enumerate(product_names, 1):
            if show_progress:
                print(f"Processing {idx}/{total}: {product_name[:50]}...", end='\r')
            
            taxonomy = self.parse_product(product_name)
            results.append(taxonomy)
        
        if show_progress:
            print("\n")
        
        # Statistics
        needs_review = sum(1 for r in results if r['needs_review'])
        avg_confidence = sum(r['confidence'] for r in results) / len(results)
        
        logger.info(f"📊 Batch complete: {total} products parsed")
        logger.info(f"⚠️  {needs_review} products need review")
        logger.info(f"📈 Average confidence: {avg_confidence:.2%}")
        
        return results


def main():
    """Test the taxonomy agent with free API"""
    
    # Test products
    test_products = [
        "Nivea Men Oil Ctrl 50ml glass btl",
        "Dove Body Wash 250ML Pump",
        "Ponds Age Miracle Cream 50g jar",
        "Lakme 9to5 Lipstick Red 3.6gm tube",
        "Gillette Mach3 Razor Blades 8ct pack"
    ]
    
    print("\n" + "="*60)
    print("🤖 TAXONOMY AGENT TEST (FREE VERSION)")
    print("="*60)
    
    # Try Groq first (fastest and easiest)
    print("\n🔍 Trying FREE providers...\n")
    
    providers = [
        ("groq", "Groq (Llama 3) - FREE, fast, no credit card"),
        ("ollama", "Ollama - 100% local, no API needed"),
        ("huggingface", "Hugging Face - FREE API")
    ]
    
    agent = None
    
    for provider_name, description in providers:
        try:
            print(f"Trying {description}...")
            agent = TaxonomyAgent(provider=provider_name)
            print(f"✅ Using {provider_name}\n")
            break
        except Exception as e:
            print(f"❌ {provider_name} not available: {e}\n")
    
    if not agent:
        print("\n⚠️  No API provider configured!")
        print("\nQuickest option - Groq (recommended):")
        print("1. Go to: https://console.groq.com/")
        print("2. Sign up (FREE, no credit card)")
        print("3. Get API key")
        print("4. Add to .env: GROQ_API_KEY=your_key_here")
        print("\nAlternative - Ollama (100% local):")
        print("1. Download: https://ollama.ai/")
        print("2. Run: ollama pull llama3.2")
        print("3. Start: ollama serve")
        return
    
    # Parse each product
    for product in test_products:
        print(f"\n📦 Product: {product}")
        taxonomy = agent.parse_product(product)
        
        print(f"   Category: {taxonomy['main_category']}")
        print(f"   Type: {taxonomy['sub_type']}")
        print(f"   Brand: {taxonomy['brand']}")
        print(f"   Size: {taxonomy['size']} {taxonomy['unit']}")
        print(f"   Container: {taxonomy['container']}")
        print(f"   Confidence: {taxonomy['confidence']:.2%}")
        print(f"   Needs Review: {taxonomy['needs_review']}")
    
    print("\n" + "="*60)
    print("✅ Test complete!")
    print("="*60)


if __name__ == "__main__":
    main()
